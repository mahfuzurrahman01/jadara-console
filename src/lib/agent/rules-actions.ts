"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import { OPERATOR_VALUES, LOGICS, type RuleState } from "@/lib/agent/rules-constants";

// Coerce a raw string to the type of the field it compares against, matching how the engine reads
// collected_data (numbers strict, booleans real bools, strings as-is).
function coerceScalar(raw: string, type: string): unknown {
  const t = raw.trim();
  if (type === "number") {
    const n = Number(t);
    return Number.isFinite(n) ? n : t;
  }
  if (type === "boolean") return t.toLowerCase() === "true" || t === "1" || t.toLowerCase() === "yes";
  return t;
}

export async function saveRule(_prev: RuleState, formData: FormData): Promise<RuleState> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return { error: "No agent to configure." };

  const logic = String(formData.get("logic") ?? "AND");
  if (!LOGICS.includes(logic as (typeof LOGICS)[number])) return { error: "Invalid logic." };

  let parsed: { field: string; op: string; value: string }[];
  try {
    parsed = JSON.parse(String(formData.get("conditions") ?? "[]"));
  } catch {
    return { error: "Could not read the conditions." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { error: "Add at least one condition." };
  }

  const db = supabaseAdmin();
  const { data: fields } = await db
    .from("field_defs")
    .select("key, type")
    .eq("agent_id", tenant.agentId);
  const typeByKey = new Map((fields ?? []).map((f) => [f.key, f.type]));

  const conditions = [];
  for (const c of parsed) {
    const field = String(c.field ?? "").trim();
    const op = String(c.op ?? "").trim();
    const rawValue = String(c.value ?? "");
    if (!typeByKey.has(field)) return { error: `Unknown field "${field}".` };
    if (!OPERATOR_VALUES.includes(op as (typeof OPERATOR_VALUES)[number])) {
      return { error: `Invalid operator on "${field}".` };
    }
    if (rawValue.trim() === "") return { error: `Enter a value for "${field}".` };

    const type = typeByKey.get(field)!;
    let value: unknown;
    if (op === "in" || op === "not_in") {
      value = rawValue
        .split(",")
        .map((s) => coerceScalar(s, type))
        .filter((v) => v !== "");
    } else {
      value = coerceScalar(rawValue, type);
    }
    conditions.push({ field, op, value });
  }

  const integration = String(formData.get("integration") ?? "").trim();
  const notify = formData.get("notify") === "on";
  const on_qualified: Record<string, unknown> = { notify };
  if (integration) on_qualified.integration = integration;

  // One rule per agent: update the existing row if present, otherwise insert.
  const { data: existing } = await db
    .from("qualification_rules")
    .select("id")
    .eq("agent_id", tenant.agentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const payload = { logic, conditions, on_qualified };
  const { error } = existing
    ? await db.from("qualification_rules").update(payload).eq("id", existing.id)
    : await db
        .from("qualification_rules")
        .insert({ ...payload, tenant_id: tenant.tenantId, agent_id: tenant.agentId });
  if (error) return { error: "Could not save the rule. Try again." };

  revalidatePath("/rules");
  return { ok: true };
}
