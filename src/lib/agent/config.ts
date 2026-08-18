import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";

// Server-side reads for the agent configuration screens. Everything is resolved against the
// signed-in user's tenant and its first agent (the MVP has one agent per tenant).

export interface AgentConfig {
  agentId: string;
  name: string;
  vertical: string;
  systemPrompt: string;
  model: string;
  active: boolean;
}

export interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  questionHint: string;
  sortOrder: number;
}

// Resolves the tenant and its agent id together. Returns null when the tenant somehow has no
// agent (should not happen after registration, which always seeds one).
export async function getAgentConfig(): Promise<AgentConfig | null> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("agents")
    .select("id, name, vertical, system_prompt, model, active")
    .eq("id", tenant.agentId)
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();
  if (!data) return null;

  return {
    agentId: data.id,
    name: data.name ?? "",
    vertical: data.vertical ?? "",
    systemPrompt: data.system_prompt ?? "",
    model: data.model ?? "gemini-flash-latest",
    active: data.active ?? true,
  };
}

export async function listFields(agentId: string): Promise<FieldRow[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("field_defs")
    .select("id, key, label, type, required, question_hint, sort_order")
    .eq("agent_id", agentId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    questionHint: f.question_hint ?? "",
    sortOrder: f.sort_order ?? 0,
  }));
}
