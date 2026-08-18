"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import { MODELS, FIELD_TYPES, type ConfigState } from "@/lib/agent/config-constants";

const KEY_RE = /^[a-z][a-z0-9_]*$/;

// Persona / model settings for the tenant's agent. The agent id is taken from the resolved
// tenant, never from the form, so a request cannot target another tenant's agent.
export async function updateAgentPersona(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return { error: "No agent to configure." };

  const name = String(formData.get("name") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "").trim();
  const systemPrompt = String(formData.get("system_prompt") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (name.length < 2) return { error: "Agent name is required." };
  if (!MODELS.includes(model as (typeof MODELS)[number])) return { error: "Pick a valid model." };

  const db = supabaseAdmin();
  const { error } = await db
    .from("agents")
    .update({ name, vertical, system_prompt: systemPrompt, model })
    .eq("id", tenant.agentId)
    .eq("tenant_id", tenant.tenantId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/agent");
  return { ok: true };
}

export async function addField(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return { error: "No agent to configure." };

  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "string").trim();
  const required = formData.get("required") === "on";
  const questionHint = String(formData.get("question_hint") ?? "").trim();

  if (!KEY_RE.test(key)) {
    return { error: "Key must be lowercase letters, numbers, or underscores and start with a letter." };
  }
  if (label.length < 1) return { error: "Label is required." };
  if (!FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number])) return { error: "Invalid type." };

  const db = supabaseAdmin();
  const { data: last } = await db
    .from("field_defs")
    .select("sort_order")
    .eq("agent_id", tenant.agentId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await db.from("field_defs").insert({
    tenant_id: tenant.tenantId,
    agent_id: tenant.agentId,
    key,
    label,
    type,
    required,
    question_hint: questionHint || null,
    sort_order: sortOrder,
  });
  if (error) {
    if (error.code === "23505") return { error: `A field with key "${key}" already exists.` };
    return { error: "Could not add the field. Try again." };
  }

  revalidatePath("/agent");
  return { ok: true };
}

// Verifies the field belongs to the tenant's agent before mutating.
async function ownField(fieldId: string, agentId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("field_defs")
    .select("id")
    .eq("id", fieldId)
    .eq("agent_id", agentId)
    .maybeSingle();
  return !!data;
}

export async function updateField(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return { error: "No agent to configure." };

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "string").trim();
  const required = formData.get("required") === "on";
  const questionHint = String(formData.get("question_hint") ?? "").trim();

  if (!(await ownField(id, tenant.agentId))) return { error: "Field not found." };
  if (label.length < 1) return { error: "Label is required." };
  if (!FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number])) return { error: "Invalid type." };

  const db = supabaseAdmin();
  const { error } = await db
    .from("field_defs")
    .update({ label, type, required, question_hint: questionHint || null })
    .eq("id", id)
    .eq("agent_id", tenant.agentId);
  if (error) return { error: "Could not save the field. Try again." };

  revalidatePath("/agent");
  return { ok: true };
}

export async function deleteField(formData: FormData): Promise<void> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return;
  const id = String(formData.get("id") ?? "");
  if (!(await ownField(id, tenant.agentId))) return;

  const db = supabaseAdmin();
  await db.from("field_defs").delete().eq("id", id).eq("agent_id", tenant.agentId);
  revalidatePath("/agent");
}
