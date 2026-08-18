import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import type { UiCondition } from "@/lib/agent/rules-constants";

export interface FieldOption {
  key: string;
  label: string;
  type: string;
}

export interface RuleConfig {
  agentId: string;
  logic: string;
  conditions: UiCondition[];
  integration: string;
  notify: boolean;
  fieldOptions: FieldOption[];
}

// Turns a stored condition value back into the string the form edits. Arrays (in / not_in) become
// a comma-separated list; everything else is stringified.
function valueToInput(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

export async function getRuleConfig(): Promise<RuleConfig | null> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return null;
  const db = supabaseAdmin();

  const [{ data: rule }, { data: fields }] = await Promise.all([
    db
      .from("qualification_rules")
      .select("logic, conditions, on_qualified")
      .eq("agent_id", tenant.agentId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("field_defs")
      .select("key, label, type")
      .eq("agent_id", tenant.agentId)
      .order("sort_order", { ascending: true }),
  ]);

  const rawConditions = (rule?.conditions as { field: string; op: string; value: unknown }[]) ?? [];
  const onQualified = (rule?.on_qualified as { integration?: string; notify?: boolean }) ?? {};

  return {
    agentId: tenant.agentId,
    logic: rule?.logic ?? "AND",
    conditions: rawConditions.map((c) => ({
      field: c.field,
      op: c.op,
      value: valueToInput(c.value),
    })),
    integration: onQualified.integration ?? "",
    notify: onQualified.notify ?? false,
    fieldOptions: (fields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type })),
  };
}
