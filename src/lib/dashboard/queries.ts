import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";

// Read models for the dashboard. Service-role reads (server components only). Every query is
// scoped to the signed-in user's tenant, resolved through the auth data access layer.

async function tenantId(): Promise<string | null> {
  const tenant = await requireTenant();
  return tenant.tenantId;
}

export interface ConversationRow {
  id: string;
  contactName: string | null;
  waId: string;
  status: string;
  qualifiedFlag: boolean;
  lastMessage: string | null;
  lastAt: string | null;
  messageCount: number;
}

export async function listConversations(): Promise<ConversationRow[]> {
  const db = supabaseAdmin();
  const tid = await tenantId();
  if (!tid) return [];

  const { data: convs } = await db
    .from("conversations")
    .select(
      "id, created_at, contacts(name, wa_id), conversation_state(qualification_status, qualified_flag)",
    )
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false });
  if (!convs) return [];

  const ids = convs.map((c) => c.id);
  const { data: msgs } = await db
    .from("messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  const last = new Map<string, { content: string; at: string }>();
  const count = new Map<string, number>();
  for (const m of msgs ?? []) {
    count.set(m.conversation_id, (count.get(m.conversation_id) ?? 0) + 1);
    if (!last.has(m.conversation_id)) last.set(m.conversation_id, { content: m.content, at: m.created_at });
  }

  return convs.map((c) => {
    const contact = first(c.contacts);
    const state = first(c.conversation_state);
    const lm = last.get(c.id);
    return {
      id: c.id,
      contactName: contact?.name ?? null,
      waId: contact?.wa_id ?? "",
      status: state?.qualification_status ?? "pending",
      qualifiedFlag: state?.qualified_flag ?? false,
      lastMessage: lm?.content ?? null,
      lastAt: lm?.at ?? c.created_at,
      messageCount: count.get(c.id) ?? 0,
    };
  });
}

export interface DashboardStats {
  conversations: number;
  qualified: number;
  leads: number;
  openTickets: number;
}

// Top-of-dashboard KPIs. Uses head-only count queries (no rows fetched), all tenant-scoped.
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = supabaseAdmin();
  const tid = await tenantId();
  if (!tid) return { conversations: 0, qualified: 0, leads: 0, openTickets: 0 };

  const head = { count: "exact" as const, head: true };
  const [conversations, qualified, leads, openTickets] = await Promise.all([
    db.from("conversations").select("id", head).eq("tenant_id", tid),
    db
      .from("conversation_state")
      .select("conversation_id", head)
      .eq("tenant_id", tid)
      .eq("qualification_status", "qualified"),
    db
      .from("conversation_state")
      .select("conversation_id", head)
      .eq("tenant_id", tid)
      .eq("qualified_flag", true),
    db.from("tickets").select("id", head).eq("tenant_id", tid).neq("status", "resolved"),
  ]);

  return {
    conversations: conversations.count ?? 0,
    qualified: qualified.count ?? 0,
    leads: leads.count ?? 0,
    openTickets: openTickets.count ?? 0,
  };
}

export interface FieldRow {
  key: string;
  label: string;
  type: string;
  required: boolean;
  value: unknown;
}

export interface ConditionRow {
  field: string;
  op: string;
  value: unknown;
  actual: unknown;
  outcome: string;
}

export interface RunRow {
  status: string;
  createdAt: string;
  request: unknown;
  response: unknown;
}

export interface ConversationDetail {
  id: string;
  contactName: string | null;
  waId: string;
  status: string;
  qualifiedFlag: boolean;
  currentStep: string | null;
  messages: { direction: string; content: string; createdAt: string }[];
  fields: FieldRow[];
  conditions: ConditionRow[];
  runs: RunRow[];
}

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  const db = supabaseAdmin();
  const tid = await tenantId();
  if (!tid) return null;
  const conv = await db
    .from("conversations")
    .select("id, agent_id, contacts(name, wa_id), conversation_state(qualification_status, qualified_flag, collected_data, current_step)")
    .eq("id", id)
    .eq("tenant_id", tid)
    .maybeSingle();
  if (conv.error || !conv.data) return null;

  const contact = first(conv.data.contacts);
  const state = first(conv.data.conversation_state);
  const collected = (state?.collected_data as Record<string, unknown>) ?? {};

  const [messages, fieldDefs, qualResult, runs] = await Promise.all([
    db.from("messages").select("direction, content, created_at").eq("conversation_id", id).order("created_at", { ascending: true }),
    db.from("field_defs").select("key, label, type, required, sort_order").eq("agent_id", conv.data.agent_id).order("sort_order", { ascending: true }),
    db.from("qualification_results").select("matched_rules, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("integration_runs").select("status, created_at, request, response").eq("conversation_id", id).order("created_at", { ascending: false }),
  ]);

  const fields: FieldRow[] = (fieldDefs.data ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    value: collected[f.key] ?? null,
  }));

  const conditions = ((qualResult.data?.matched_rules as ConditionRow[] | undefined) ?? []).map((c) => ({
    field: c.field,
    op: c.op,
    value: c.value,
    actual: c.actual,
    outcome: c.outcome,
  }));

  return {
    id,
    contactName: contact?.name ?? null,
    waId: contact?.wa_id ?? "",
    status: state?.qualification_status ?? "pending",
    qualifiedFlag: state?.qualified_flag ?? false,
    currentStep: state?.current_step ?? null,
    messages: (messages.data ?? []).map((m) => ({ direction: m.direction, content: m.content, createdAt: m.created_at })),
    fields,
    conditions,
    runs: (runs.data ?? []).map((r) => ({ status: r.status, createdAt: r.created_at, request: r.request, response: r.response })),
  };
}

export interface LeadRow {
  conversationId: string;
  contactName: string | null;
  waId: string;
  crmRecordId: string | null;
  createdAt: string;
}

export async function listLeads(): Promise<LeadRow[]> {
  const db = supabaseAdmin();
  const tid = await tenantId();
  if (!tid) return [];

  const { data } = await db
    .from("conversation_state")
    .select("conversation_id, updated_at, conversations(created_at, contacts(name, wa_id))")
    .eq("tenant_id", tid)
    .eq("qualified_flag", true)
    .order("updated_at", { ascending: false });
  if (!data) return [];

  const ids = data.map((d) => d.conversation_id);
  const { data: runs } = await db
    .from("integration_runs")
    .select("conversation_id, response, status, created_at")
    .in("conversation_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "success")
    .order("created_at", { ascending: false });

  const crm = new Map<string, string>();
  for (const r of runs ?? []) {
    if (crm.has(r.conversation_id)) continue;
    const resp = r.response as { body?: { id?: string } } | null;
    if (resp?.body?.id) crm.set(r.conversation_id, resp.body.id);
  }

  return data.map((d) => {
    const conv = first(d.conversations);
    const contact = first(conv?.contacts);
    return {
      conversationId: d.conversation_id,
      contactName: contact?.name ?? null,
      waId: contact?.wa_id ?? "",
      crmRecordId: crm.get(d.conversation_id) ?? null,
      createdAt: d.updated_at,
    };
  });
}

// Supabase types embedded relations as arrays; for to-one relations we take the first element.
function first<T>(v: T[] | T | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}
