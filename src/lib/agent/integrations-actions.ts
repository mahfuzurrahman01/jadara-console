"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import { encryptSecret } from "@/lib/secrets/crypto";
import { putSecret } from "@/lib/repo/ingest";
import {
  HTTP_METHODS,
  AUTH_TYPES,
  ARG_TYPES,
  type UiArg,
  type IntegrationState,
} from "@/lib/agent/integrations-constants";

const NAME_RE = /^[a-z][a-z0-9_]*$/;
const ARG_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export async function saveIntegration(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return { error: "No agent to configure." };

  const name = String(formData.get("name") ?? "").trim();
  const method = String(formData.get("method") ?? "POST").trim().toUpperCase();
  const url = String(formData.get("url") ?? "").trim();
  const authType = String(formData.get("auth_type") ?? "none").trim();
  const secretValue = String(formData.get("secret") ?? "");
  const enabled = formData.get("enabled") === "on";

  if (!NAME_RE.test(name)) {
    return { error: "Name must be lowercase letters, numbers, or underscores and start with a letter." };
  }
  if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) return { error: "Invalid method." };
  if (!/^https?:\/\/.+|^\/.+/.test(url)) {
    return { error: "URL must start with http(s):// or / for a same-app path." };
  }
  if (!AUTH_TYPES.includes(authType as (typeof AUTH_TYPES)[number])) return { error: "Invalid auth type." };

  let parsed: UiArg[];
  try {
    parsed = JSON.parse(String(formData.get("args") ?? "[]"));
  } catch {
    return { error: "Could not read the arguments." };
  }
  if (!Array.isArray(parsed)) parsed = [];

  const fieldMapping: Record<string, string> = {};
  const properties: Record<string, { type: string }> = {};
  const required: string[] = [];
  const seen = new Set<string>();
  for (const a of parsed) {
    const arg = String(a.arg ?? "").trim();
    const source = String(a.source ?? "").trim();
    const type = String(a.type ?? "string").trim();
    if (!ARG_RE.test(arg)) return { error: `Invalid argument name "${arg}".` };
    if (seen.has(arg)) return { error: `Duplicate argument "${arg}".` };
    if (!source) return { error: `Pick a source for "${arg}".` };
    if (!ARG_TYPES.includes(type as (typeof ARG_TYPES)[number])) return { error: `Invalid type for "${arg}".` };
    seen.add(arg);
    fieldMapping[arg] = source;
    properties[arg] = { type };
    if (a.required) required.push(arg);
  }

  const inputSchema = { type: "object", properties, required };

  const db = supabaseAdmin();

  // Store the secret encrypted at rest and reference it by a stable ref derived from the name. The
  // secret value itself is never written to the integrations row.
  let authSecretRef: string | null = null;
  if (authType === "bearer") {
    authSecretRef = `${name}_token`;
    if (secretValue.length > 0) {
      const { ciphertext, iv } = encryptSecret(secretValue);
      await putSecret(tenant.tenantId, authSecretRef, ciphertext, iv);
    }
  }

  const payload = {
    name,
    method,
    url,
    auth_type: authType,
    auth_secret_ref: authSecretRef,
    input_schema: inputSchema,
    field_mapping: fieldMapping,
    enabled,
  };

  const { data: existing } = await db
    .from("integrations")
    .select("id, auth_secret_ref")
    .eq("agent_id", tenant.agentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // When switching to bearer without entering a new secret, keep the previously stored ref so an
  // existing secret is not orphaned.
  if (authType === "bearer" && secretValue.length === 0 && existing?.auth_secret_ref) {
    payload.auth_secret_ref = existing.auth_secret_ref;
  }

  const { error } = existing
    ? await db.from("integrations").update(payload).eq("id", existing.id)
    : await db
        .from("integrations")
        .insert({ ...payload, tenant_id: tenant.tenantId, agent_id: tenant.agentId });
  if (error) return { error: "Could not save the integration. Try again." };

  revalidatePath("/integrations");
  return { ok: true };
}
