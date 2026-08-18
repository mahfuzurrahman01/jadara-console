import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/auth/dal";
import type { UiArg } from "@/lib/agent/integrations-constants";

export interface SourceOption {
  value: string;
  label: string;
}

export interface IntegrationConfig {
  integrationId: string | null;
  name: string;
  method: string;
  url: string;
  authType: string;
  authSecretRef: string;
  hasSecret: boolean;
  enabled: boolean;
  args: UiArg[];
  sourceOptions: SourceOption[];
}

// Reconstructs the editable arg list from the stored field_mapping + input_schema.
function argsFromStored(
  fieldMapping: Record<string, string>,
  inputSchema: Record<string, unknown>,
): UiArg[] {
  const props = (inputSchema.properties as Record<string, { type?: string }>) ?? {};
  const required = Array.isArray(inputSchema.required) ? (inputSchema.required as string[]) : [];
  return Object.entries(fieldMapping).map(([arg, source]) => ({
    arg,
    source,
    type: props[arg]?.type ?? "string",
    required: required.includes(arg),
  }));
}

export async function getIntegrationConfig(): Promise<IntegrationConfig | null> {
  const tenant = await requireTenant();
  if (!tenant.agentId) return null;
  const db = supabaseAdmin();

  const [{ data: integration }, { data: fields }] = await Promise.all([
    db
      .from("integrations")
      .select("id, name, method, url, auth_type, auth_secret_ref, input_schema, field_mapping, enabled")
      .eq("agent_id", tenant.agentId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("field_defs")
      .select("key, label")
      .eq("agent_id", tenant.agentId)
      .order("sort_order", { ascending: true }),
  ]);

  const sourceOptions: SourceOption[] = [
    { value: "contact.name", label: "Contact name (from WhatsApp)" },
    ...(fields ?? []).map((f) => ({ value: f.key, label: `${f.label} (${f.key})` })),
  ];

  let hasSecret = false;
  if (integration?.auth_secret_ref) {
    const { data: secret } = await db
      .from("secrets")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("key", integration.auth_secret_ref)
      .maybeSingle();
    hasSecret = !!secret;
  }

  return {
    integrationId: integration?.id ?? null,
    name: integration?.name ?? "",
    method: integration?.method ?? "POST",
    url: integration?.url ?? "",
    authType: integration?.auth_type ?? "none",
    authSecretRef: integration?.auth_secret_ref ?? "",
    hasSecret,
    enabled: integration?.enabled ?? true,
    args: integration
      ? argsFromStored(
          (integration.field_mapping as Record<string, string>) ?? {},
          (integration.input_schema as Record<string, unknown>) ?? {},
        )
      : [],
    sourceOptions,
  };
}
