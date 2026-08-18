import "server-only";
import {
  getConversationContext,
  createTicketIfNone,
  insertOutboundMessage,
  getTenantOwnerEmail,
} from "@/lib/repo/ingest";
import { getChannelProvider } from "@/lib/channel/openwa";
import { notifyTicketCreated } from "@/lib/notify/notify";

// Open a human-handoff ticket for a conversation and, only when it is newly opened, send one
// holding message to the customer and notify the owner. Idempotent: a conversation that already
// has an active ticket is left untouched, so a repeated ask (or a manual escalation on top of an
// AI one) never double-sends. Shared by the agent loop (source "ai") and the owner action
// (source "manual").
export async function raiseHandoffTicket(
  conversationId: string,
  reason: string,
  source: "ai" | "manual",
): Promise<{ created: boolean }> {
  const ctx = await getConversationContext(conversationId);
  if (!ctx) return { created: false };

  const { created } = await createTicketIfNone({
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    conversationId,
    reason,
    source,
  });
  if (!created) return { created: false };

  // Let the customer know a person is coming. Sent once, on first open.
  const holding =
    `Thanks. I am connecting you with someone from the ${ctx.tenantName} team. ` +
    `They will reach out to you shortly.`;
  try {
    const channel = getChannelProvider();
    const { messageId } = await channel.sendText(ctx.sessionId, ctx.chatId, holding);
    await insertOutboundMessage(ctx.tenantId, conversationId, holding, messageId || null);
  } catch (err) {
    console.warn("[ticket] holding message failed", (err as Error)?.message);
  }

  const ownerEmail = await getTenantOwnerEmail(ctx.tenantId);
  await notifyTicketCreated({
    tenantName: ctx.tenantName,
    ownerEmail,
    contactName: ctx.contactName,
    conversationId,
    reason,
  });

  return { created: true };
}
