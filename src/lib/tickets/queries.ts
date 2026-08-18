import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import type { TicketStatus } from "./constants";

// Read model for the tickets list. Service-role reads from server components only, scoped to the
// signed-in user's tenant.

export interface TicketRow {
  id: string;
  conversationId: string;
  contactName: string | null;
  waId: string | null;
  reason: string;
  source: string;
  status: TicketStatus;
  createdAt: string;
}

export async function listTickets(): Promise<TicketRow[]> {
  const tenant = await requireTenant();
  const db = supabaseAdmin();

  const { data } = await db
    .from("tickets")
    .select("id, conversation_id, reason, source, status, created_at, conversations(contacts(name, wa_id))")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });
  if (!data) return [];

  return data.map((t) => {
    const conv = first(t.conversations);
    const contact = conv ? first(conv.contacts) : undefined;
    return {
      id: t.id,
      conversationId: t.conversation_id,
      contactName: contact?.name ?? null,
      waId: contact?.wa_id ?? null,
      reason: t.reason,
      source: t.source,
      status: t.status as TicketStatus,
      createdAt: t.created_at,
    };
  });
}

// Supabase types a to-one relation as an array in some cases; normalize to a single row.
function first<T>(v: T[] | T | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}
