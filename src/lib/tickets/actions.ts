"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import { raiseHandoffTicket } from "@/lib/tickets/handoff";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";

// Change a ticket's status. Scoped to the signed-in tenant so one tenant can never touch another's
// tickets. Resolving a ticket un-pauses the agent on that conversation (the pause is derived from
// the presence of a non-resolved ticket). Called directly from the kanban board with the target
// column's status; returns ok so the client can revert an optimistic move on failure.
export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<{ ok: boolean }> {
  const tenant = await requireTenant();
  if (!ticketId || !TICKET_STATUSES.includes(status)) return { ok: false };

  const db = supabaseAdmin();
  const { error } = await db
    .from("tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", ticketId)
    .eq("tenant_id", tenant.tenantId);
  if (error) return { ok: false };

  revalidatePath("/tickets");
  return { ok: true };
}

// Owner-initiated escalation from a conversation. Verifies the conversation belongs to the tenant,
// then opens a ticket (holding message + owner notify happen inside, idempotently).
export async function createTicketManual(formData: FormData): Promise<void> {
  const tenant = await requireTenant();
  const conversationId = String(formData.get("conversationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Owner escalated to a person.";
  if (!conversationId) return;

  const db = supabaseAdmin();
  const { data: conv } = await db
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();
  if (!conv) return;

  await raiseHandoffTicket(conversationId, reason, "manual");

  revalidatePath("/tickets");
  revalidatePath(`/conversations/${conversationId}`);
}
