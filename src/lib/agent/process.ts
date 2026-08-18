import {
  getConversationContext,
  getFieldDefs,
  getCollectedData,
  saveConversationState,
  insertOutboundMessage,
  getQualificationRule,
  getQualificationStatus,
  setQualificationStatus,
  insertQualificationResult,
  getIntegrationByName,
  getQualifiedFlag,
  setQualifiedFlag,
  hasSuccessfulRun,
  getTenantOwnerEmail,
  hasOpenTicket,
  type FieldDef,
  type ConversationContext,
} from "@/lib/repo/ingest";
import { getLLM, HANDOFF_KEY } from "@/lib/llm/gemini";
import { getChannelProvider } from "@/lib/channel/openwa";
import { raiseHandoffTicket } from "@/lib/tickets/handoff";
import { evaluateRule, type Condition, type Logic } from "@/lib/qualify/engine";
import { runIntegration } from "@/lib/integrations/executor";
import { notifyLeadQualified } from "@/lib/notify/notify";

// Per-conversation turn scheduler. Rapid inbound messages (or a slow model) would otherwise each
// spawn a concurrent turn, and a late-finishing older turn could send a stale reply after a newer
// one already advanced or closed the conversation. Serialize turns per conversation and coalesce:
// while a turn runs, additional arrivals set a "pending" flag instead of starting their own turn;
// one more turn then runs against the latest state. In-memory is sufficient for the single-process
// dev/demo runtime; a durable queue would replace this in production.
const running = new Set<string>();
const pending = new Set<string>();

export async function processInboundMessage(conversationId: string): Promise<void> {
  if (running.has(conversationId)) {
    pending.add(conversationId);
    return;
  }
  running.add(conversationId);
  try {
    do {
      pending.delete(conversationId);
      try {
        await runOneTurn(conversationId);
      } catch (err) {
        console.error("[agent] turn failed", (err as Error)?.message);
      }
    } while (pending.has(conversationId));
  } finally {
    running.delete(conversationId);
    pending.delete(conversationId);
  }
}

// A single agent turn. Given a conversation with a freshly persisted inbound message:
//   1. Extract structured field values from the conversation.
//   2. Merge them into conversation_state.collected_data.
//   3. Qualify deterministically; on first qualification, run the integration and notify.
//   4. Generate a reply that asks for the next missing required field, or closes when complete.
//   5. Send the reply and persist it.
async function runOneTurn(conversationId: string): Promise<void> {
  const ctx = await getConversationContext(conversationId);
  if (!ctx || ctx.history.length === 0) return;

  // Human handoff: once a conversation has an active ticket, the agent is paused so a person can
  // take over. Inbound messages are still persisted by the webhook; we just do not auto-reply.
  if (await hasOpenTicket(conversationId)) {
    console.log("[agent] paused, open ticket", { conversationId });
    return;
  }

  const llm = getLLM();
  const [fields, collected] = await Promise.all([
    getFieldDefs(ctx.agentId),
    getCollectedData(conversationId),
  ]);

  // 1 + 2: extraction pass, then merge only newly stated, type-valid values. A failed extraction
  // (transient model error, quota) must not abort the turn: keep the prior collected_data and still
  // reply, so the conversation never stalls. The same call flags a human-handoff request.
  let handoffRequested = false;
  if (fields.length > 0) {
    try {
      const extracted = await llm.extract({
        model: ctx.model,
        fields: fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          hint: f.questionHint,
        })),
        history: ctx.history,
      });
      handoffRequested = extracted[HANDOFF_KEY] === true;
      mergeCollected(collected, extracted, fields);
    } catch (err) {
      console.warn("[agent] extraction failed, continuing", (err as Error)?.message);
    }
  }

  // If the customer asked for a person, open a ticket (holding message + owner notify happen
  // inside), then stop this turn: no qualification, no normal reply. The pause check above handles
  // every following message until the ticket is resolved.
  if (handoffRequested) {
    await raiseHandoffTicket(conversationId, "Customer asked to speak with a person.", "ai");
    console.log("[agent] handoff ticket raised", { conversationId });
    return;
  }

  // 3: find the next missing required field (ask order), or none when complete.
  const missing = fields.find((f) => f.required && !hasValue(collected[f.key]));
  const currentStep = missing ? missing.key : "complete";

  await saveConversationState(conversationId, ctx.tenantId, collected, currentStep);

  // Deterministic qualification over the collected data (no LLM). Runs every turn; incomplete data
  // stays pending. Persist the status, and append an audit row only on a status change so the
  // qualification_results history stays meaningful rather than one row per message.
  const status = await runQualification(conversationId, ctx.tenantId, ctx.agentId, collected);

  // On qualified, call the tenant's integration and notify the owner. Idempotent: never acts twice
  // for the same conversation.
  if (status === "qualified") {
    await handleQualified(ctx, conversationId, collected);
  }

  // Steer the reply without re-injecting collected PII into the prompt: pass only field keys
  // already answered and the single next field to ask for.
  const answeredKeys = fields.filter((f) => hasValue(collected[f.key])).map((f) => f.key);
  const instruction = missing
    ? `Fields already answered (do not ask for these again): ${answeredKeys.join(", ") || "none"}. ` +
      `Ask the customer for exactly one more detail now: ${missing.questionHint ?? missing.label}. ` +
      `Keep it to one short, warm question.`
    : `All required details have been collected. Warmly thank the customer and tell them the ${ctx.tenantName} ` +
      `team will review their eligibility and follow up. Do not promise support. Ask no further questions.`;

  const reply = await llm.generateReply({
    model: ctx.model,
    systemPrompt: `${ctx.systemPrompt}\n\n${instruction}`,
    history: ctx.history,
  });
  if (!reply) {
    console.warn("[agent] empty reply, nothing sent", { conversationId });
    return;
  }

  const channel = getChannelProvider();
  const { messageId } = await channel.sendText(ctx.sessionId, ctx.chatId, reply);
  await insertOutboundMessage(ctx.tenantId, conversationId, reply, messageId || null);

  console.log("[agent] reply sent", { conversationId, messageId, currentStep });
}

async function runQualification(
  conversationId: string,
  tenantId: string,
  agentId: string,
  collected: Record<string, unknown>,
): Promise<string> {
  const rule = await getQualificationRule(agentId);
  if (!rule) return "pending";

  const result = evaluateRule(
    { logic: rule.logic as Logic, conditions: (rule.conditions as Condition[]) ?? [] },
    collected,
  );

  const prior = await getQualificationStatus(conversationId);
  if (result.status !== prior) {
    await setQualificationStatus(conversationId, result.status);
    await insertQualificationResult(tenantId, conversationId, result.status, result.matched);
    console.log("[agent] qualification", { conversationId, from: prior, to: result.status });
  }
  return result.status;
}

// Fire the integration + notification exactly once per qualified conversation. Guarded by the
// qualified_flag and by an existing successful run, so a webhook retry or a later message never
// double-creates the CRM record. The flag is set only after a successful integration, so a failed
// call is retried on the next message.
async function handleQualified(
  ctx: ConversationContext,
  conversationId: string,
  collected: Record<string, unknown>,
): Promise<void> {
  if (await getQualifiedFlag(conversationId)) return;

  const rule = await getQualificationRule(ctx.agentId);
  const onQualified = (rule?.onQualified ?? {}) as { integration?: string; notify?: boolean };

  let crmRecordId: string | null = null;

  if (onQualified.integration) {
    const integration = await getIntegrationByName(ctx.agentId, onQualified.integration);
    if (!integration || !integration.enabled) {
      console.warn("[agent] integration missing or disabled", { name: onQualified.integration });
      return;
    }
    if (await hasSuccessfulRun(conversationId, integration.id)) {
      await setQualifiedFlag(conversationId);
      return;
    }

    const outcome = await runIntegration(
      integration,
      ctx.tenantId,
      conversationId,
      collected,
      ctx.contactName,
    );
    if (outcome.status !== "success") {
      console.warn("[agent] integration not successful", { status: outcome.status });
      return; // leave qualified_flag false so the next message retries
    }
    const resp = outcome.responseBody as { id?: string } | null;
    crmRecordId = resp?.id ?? null;
  }

  if (onQualified.notify) {
    const ownerEmail = await getTenantOwnerEmail(ctx.tenantId);
    await notifyLeadQualified({
      tenantName: ctx.tenantName,
      ownerEmail,
      contactName: ctx.contactName,
      conversationId,
      crmRecordId,
    });
  }

  await setQualifiedFlag(conversationId);
  console.log("[agent] qualified actioned", { conversationId, crmRecordId });
}

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

// Merge extracted values into collected: skip nulls, coerce to the field's type, and never clear an
// already-answered field with a null. A later message can still correct a value (non-null wins).
function mergeCollected(
  collected: Record<string, unknown>,
  extracted: Record<string, string | number | boolean | null>,
  fields: FieldDef[],
): void {
  for (const f of fields) {
    const raw = extracted[f.key];
    if (raw === null || raw === undefined || raw === "") continue;

    if (f.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n)) collected[f.key] = n;
    } else if (f.type === "boolean") {
      if (typeof raw === "boolean") collected[f.key] = raw;
      else if (raw === "true") collected[f.key] = true;
      else if (raw === "false") collected[f.key] = false;
    } else {
      collected[f.key] = String(raw);
    }
  }
}
