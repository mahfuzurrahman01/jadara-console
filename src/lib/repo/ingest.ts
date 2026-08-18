import { supabaseAdmin } from "@/lib/supabase/admin";

// Persistence helpers for inbound WhatsApp traffic. All use the service-role client and so
// bypass RLS; they must only ever run server-side (webhook route, jobs).

export interface ResolvedChannel {
  tenantId: string;
  agentId: string;
}

// Map an OpenWA session to its tenant/agent via channel_connections. Returns null for an
// unknown session (e.g. a stale webhook after the mapping was deleted).
export async function resolveChannel(sessionId: string): Promise<ResolvedChannel | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("channel_connections")
    .select("tenant_id, agent_id")
    .eq("provider", "openwa")
    .eq("external_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { tenantId: data.tenant_id, agentId: data.agent_id };
}

export async function updateChannelStatus(sessionId: string, status: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("channel_connections")
    .update({ status })
    .eq("provider", "openwa")
    .eq("external_session_id", sessionId);
  if (error) throw error;
}

// Find or create a contact keyed by (tenant_id, wa_id). Name is only written when we learn one,
// so a later nameless message never clears a name we already have.
export async function findOrCreateContact(
  tenantId: string,
  waId: string,
  name: string | null,
): Promise<string> {
  const db = supabaseAdmin();
  const existing = await db
    .from("contacts")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("wa_id", waId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (name && !existing.data.name) {
      await db.from("contacts").update({ name }).eq("id", existing.data.id);
    }
    return existing.data.id;
  }

  const inserted = await db
    .from("contacts")
    .insert({ tenant_id: tenantId, wa_id: waId, name })
    .select("id")
    .single();
  if (inserted.error) {
    // Racing inserts collide on the (tenant_id, wa_id) unique index; re-read the winner.
    const reread = await db
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("wa_id", waId)
      .single();
    if (reread.error) throw inserted.error;
    return reread.data.id;
  }
  return inserted.data.id;
}

// Return the current open conversation for a contact, creating one (plus its conversation_state
// row) when none is open. One open conversation per contact/agent is enough for the demo.
export async function getOrCreateOpenConversation(
  tenantId: string,
  agentId: string,
  contactId: string,
): Promise<string> {
  const db = supabaseAdmin();
  const open = await db
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open.error) throw open.error;
  if (open.data) return open.data.id;

  const created = await db
    .from("conversations")
    .insert({ tenant_id: tenantId, agent_id: agentId, contact_id: contactId, status: "open" })
    .select("id")
    .single();
  if (created.error) throw created.error;

  const conversationId = created.data.id;
  const state = await db
    .from("conversation_state")
    .insert({ conversation_id: conversationId, tenant_id: tenantId })
    .select("conversation_id")
    .maybeSingle();
  // A concurrent create may already have seeded the state row; a duplicate is fine to ignore.
  if (state.error && state.error.code !== "23505") throw state.error;

  return conversationId;
}

export interface ConversationContext {
  tenantId: string;
  tenantName: string;
  agentId: string;
  sessionId: string; // OpenWA external_session_id used to send the reply
  chatId: string; // contact wa_id, reused verbatim as the reply target
  contactName: string | null;
  systemPrompt: string;
  model: string;
  history: { role: "user" | "agent"; text: string }[];
}

// Load everything the agent needs to reply: tenant/agent, the channel session to send on, the
// contact's chat id, the agent persona/model, and the ordered message history.
export async function getConversationContext(
  conversationId: string,
): Promise<ConversationContext | null> {
  const db = supabaseAdmin();
  const conv = await db
    .from("conversations")
    .select("id, tenant_id, agent_id, contact_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conv.error) throw conv.error;
  if (!conv.data) return null;

  const [agent, contact, channel, msgs, tenant] = await Promise.all([
    db.from("agents").select("system_prompt, model").eq("id", conv.data.agent_id).single(),
    db.from("contacts").select("wa_id, name").eq("id", conv.data.contact_id).single(),
    db
      .from("channel_connections")
      .select("external_session_id")
      .eq("provider", "openwa")
      .eq("agent_id", conv.data.agent_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("messages")
      .select("direction, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    db.from("tenants").select("name").eq("id", conv.data.tenant_id).single(),
  ]);
  if (agent.error) throw agent.error;
  if (contact.error) throw contact.error;
  if (channel.error) throw channel.error;
  if (msgs.error) throw msgs.error;
  if (tenant.error) throw tenant.error;
  if (!channel.data) return null;

  return {
    tenantId: conv.data.tenant_id,
    tenantName: tenant.data.name ?? "",
    agentId: conv.data.agent_id,
    sessionId: channel.data.external_session_id,
    chatId: contact.data.wa_id,
    contactName: contact.data.name ?? null,
    systemPrompt: agent.data.system_prompt ?? "",
    model: agent.data.model ?? "gemini-flash-latest",
    history: (msgs.data ?? []).map((m) => ({
      role: m.direction === "outbound" ? ("agent" as const) : ("user" as const),
      text: m.content,
    })),
  };
}

export async function insertOutboundMessage(
  tenantId: string,
  conversationId: string,
  content: string,
  externalMessageId: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("messages").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    direction: "outbound",
    type: "text",
    content,
    external_message_id: externalMessageId,
  });
  if (error) throw error;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  questionHint: string | null;
  sortOrder: number;
}

// Field schema the agent collects, in ask order.
export async function getFieldDefs(agentId: string): Promise<FieldDef[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("field_defs")
    .select("key, label, type, required, question_hint, sort_order")
    .eq("agent_id", agentId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    questionHint: f.question_hint,
    sortOrder: f.sort_order,
  }));
}

export async function getCollectedData(
  conversationId: string,
): Promise<Record<string, unknown>> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("conversation_state")
    .select("collected_data")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return (data?.collected_data as Record<string, unknown>) ?? {};
}

export async function saveConversationState(
  conversationId: string,
  tenantId: string,
  collectedData: Record<string, unknown>,
  currentStep: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("conversation_state").upsert(
    {
      conversation_id: conversationId,
      tenant_id: tenantId,
      collected_data: collectedData,
      current_step: currentStep,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );
  if (error) throw error;
}

export interface QualRuleRow {
  logic: string;
  conditions: unknown;
  onQualified: Record<string, unknown>;
}

// The agent's qualification rule (one per agent for the demo).
export async function getQualificationRule(agentId: string): Promise<QualRuleRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("qualification_rules")
    .select("logic, conditions, on_qualified")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    logic: data.logic,
    conditions: data.conditions,
    onQualified: (data.on_qualified as Record<string, unknown>) ?? {},
  };
}

export async function getQualificationStatus(conversationId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("conversation_state")
    .select("qualification_status")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data?.qualification_status ?? "pending";
}

export async function setQualificationStatus(
  conversationId: string,
  status: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("conversation_state")
    .update({ qualification_status: status, updated_at: new Date().toISOString() })
    .eq("conversation_id", conversationId);
  if (error) throw error;
}

// Append an audit row capturing the decision and the per-condition breakdown.
export async function insertQualificationResult(
  tenantId: string,
  conversationId: string,
  status: string,
  matched: unknown,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("qualification_results").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    status,
    matched_rules: matched,
  });
  if (error) throw error;
}

export interface IntegrationRow {
  id: string;
  name: string;
  method: string;
  url: string;
  authType: string;
  authSecretRef: string | null;
  inputSchema: Record<string, unknown>;
  fieldMapping: Record<string, string>;
  enabled: boolean;
}

export async function getIntegrationByName(
  agentId: string,
  name: string,
): Promise<IntegrationRow | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("integrations")
    .select("id, name, method, url, auth_type, auth_secret_ref, input_schema, field_mapping, enabled")
    .eq("agent_id", agentId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    method: data.method,
    url: data.url,
    authType: data.auth_type,
    authSecretRef: data.auth_secret_ref,
    inputSchema: (data.input_schema as Record<string, unknown>) ?? {},
    fieldMapping: (data.field_mapping as Record<string, string>) ?? {},
    enabled: data.enabled,
  };
}

export async function getQualifiedFlag(conversationId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("conversation_state")
    .select("qualified_flag")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data?.qualified_flag ?? false;
}

export async function setQualifiedFlag(conversationId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("conversation_state")
    .update({ qualified_flag: true, updated_at: new Date().toISOString() })
    .eq("conversation_id", conversationId);
  if (error) throw error;
}

// True when a successful run for this integration already exists on the conversation. Second guard
// (besides qualified_flag) so the executor never double-creates a record.
export async function hasSuccessfulRun(
  conversationId: string,
  integrationId: string,
): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("integration_runs")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("integration_id", integrationId)
    .eq("status", "success")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function insertIntegrationRun(
  tenantId: string,
  conversationId: string,
  integrationId: string,
  request: unknown,
  response: unknown,
  status: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("integration_runs").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    integration_id: integrationId,
    request,
    response,
    status,
  });
  if (error) throw error;
}

// Secrets at rest. Returns the stored ciphertext/iv for a tenant key, or null if not provisioned.
export async function getSecret(
  tenantId: string,
  key: string,
): Promise<{ ciphertext: string; iv: string } | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("secrets")
    .select("ciphertext, iv")
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ciphertext: data.ciphertext, iv: data.iv };
}

export async function putSecret(
  tenantId: string,
  key: string,
  ciphertext: string,
  iv: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("secrets")
    .upsert({ tenant_id: tenantId, key, ciphertext, iv }, { onConflict: "tenant_id,key" });
  if (error) throw error;
}

// The owner's email for a tenant, used to address the qualified-lead notification. Returns null
// when no owner membership resolves to a user, so the caller falls back to a log-only notice.
export async function getTenantOwnerEmail(tenantId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const member = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (member.error) throw member.error;
  if (!member.data) return null;

  const user = await db
    .from("users")
    .select("email")
    .eq("id", member.data.user_id)
    .maybeSingle();
  if (user.error) throw user.error;
  return user.data?.email ?? null;
}

// The owner's user id for a tenant, used to assign handoff tickets. Null when none resolves.
export async function getTenantOwnerUserId(tenantId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const member = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (member.error) throw member.error;
  return member.data?.user_id ?? null;
}

// True when the conversation has an active (non-resolved) ticket, i.e. the agent is paused because
// a human is handling it.
export async function hasOpenTicket(conversationId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("tickets")
    .select("id")
    .eq("conversation_id", conversationId)
    .neq("status", "resolved")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export interface NewTicket {
  tenantId: string;
  agentId: string;
  conversationId: string;
  reason: string;
  source: "ai" | "manual";
}

// Open a ticket for a conversation unless one is already active. Returns whether a new row was
// created, so the caller sends the holding message and notifies exactly once. The partial unique
// index is the backstop against a race; a violation is treated as "already open".
export async function createTicketIfNone(t: NewTicket): Promise<{ created: boolean }> {
  const db = supabaseAdmin();
  if (await hasOpenTicket(t.conversationId)) return { created: false };

  const assigned = await getTenantOwnerUserId(t.tenantId);
  const { error } = await db.from("tickets").insert({
    tenant_id: t.tenantId,
    agent_id: t.agentId,
    conversation_id: t.conversationId,
    assigned_user_id: assigned,
    reason: t.reason,
    source: t.source,
  });
  if (error) {
    // Unique-violation backstop: another writer opened one first.
    if (error.code === "23505") return { created: false };
    throw error;
  }
  return { created: true };
}

export interface InboundMessage {
  type: string;
  content: string;
  externalMessageId: string | null;
}

// Persist one inbound message. Idempotent on external_message_id when present, so a webhook
// retry does not double-insert.
export async function insertInboundMessage(
  tenantId: string,
  conversationId: string,
  msg: InboundMessage,
): Promise<{ inserted: boolean }> {
  const db = supabaseAdmin();
  if (msg.externalMessageId) {
    const dup = await db
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("external_message_id", msg.externalMessageId)
      .maybeSingle();
    if (dup.error) throw dup.error;
    if (dup.data) return { inserted: false };
  }

  const { error } = await db.from("messages").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    direction: "inbound",
    type: msg.type,
    content: msg.content,
    external_message_id: msg.externalMessageId,
  });
  if (error) throw error;
  return { inserted: true };
}
