import { env } from "@/lib/env";
import { insertIntegrationRun, type IntegrationRow } from "@/lib/repo/ingest";
import { resolveSecret } from "@/lib/secrets/crypto";
import { assertPublicUrl, BlockedUrlError } from "./ssrf";

const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface IntegrationOutcome {
  status: "success" | "error" | "invalid" | "blocked";
  httpStatus?: number;
  responseBody?: unknown;
}

// Execute a tenant's integration for a qualified conversation: map collected data to the payload,
// validate it against the integration's input_schema, guard the target against SSRF, inject auth
// from the encrypted secret, POST with a timeout and response-size cap, and record an audit run.
// The stored request NEVER contains the auth header or token.
export async function runIntegration(
  integration: IntegrationRow,
  tenantId: string,
  conversationId: string,
  collected: Record<string, unknown>,
  contactName: string | null,
): Promise<IntegrationOutcome> {
  // 1. Map fields.
  const args = mapArgs(integration.fieldMapping, collected, contactName);

  // 2. Validate against input_schema.
  const invalid = validate(args, integration.inputSchema);
  if (invalid) {
    await record(tenantId, conversationId, integration.id, { args }, { error: invalid }, "invalid");
    return { status: "invalid", responseBody: invalid };
  }

  // 3. Resolve + SSRF-guard the target URL (relative URLs resolve against APP_PUBLIC_URL).
  const rawUrl = integration.url.startsWith("/")
    ? `${env.appPublicUrl.replace(/\/$/, "")}${integration.url}`
    : integration.url;
  let url: URL;
  try {
    url = await assertPublicUrl(rawUrl);
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      await record(tenantId, conversationId, integration.id, { url: rawUrl, args }, { error: err.message }, "blocked");
      return { status: "blocked", responseBody: err.message };
    }
    throw err;
  }

  // 4. Inject auth from the encrypted secret (not stored in the audit request). Any failure here
  // (missing secret, misconfigured/absent encryption key) records an error run rather than crashing.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (integration.authType === "bearer" && integration.authSecretRef) {
    let token: string | null;
    try {
      token = await resolveSecret(tenantId, integration.authSecretRef);
    } catch (err) {
      const msg = `Secret resolution failed for ${integration.authSecretRef}: ${(err as Error).message}`;
      await record(tenantId, conversationId, integration.id, { url: rawUrl, args }, { error: msg }, "error");
      return { status: "error", responseBody: msg };
    }
    if (!token) {
      const msg = `Missing secret for ref ${integration.authSecretRef}`;
      await record(tenantId, conversationId, integration.id, { url: rawUrl, args }, { error: msg }, "error");
      return { status: "error", responseBody: msg };
    }
    headers.Authorization = `Bearer ${token}`;
  }

  // 5. Call with a timeout and a response-size cap.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: integration.method || "POST",
      headers,
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    const body = await readCapped(res, MAX_RESPONSE_BYTES);
    const status = res.ok ? "success" : "error";
    // Audit request stores the URL + mapped args only, never the Authorization header.
    await record(
      tenantId,
      conversationId,
      integration.id,
      { url: rawUrl, method: integration.method, args },
      { httpStatus: res.status, body },
      status,
    );
    return { status, httpStatus: res.status, responseBody: body };
  } catch (err) {
    const msg = controller.signal.aborted ? `Timeout after ${TIMEOUT_MS}ms` : (err as Error).message;
    await record(tenantId, conversationId, integration.id, { url: rawUrl, args }, { error: msg }, "error");
    return { status: "error", responseBody: msg };
  } finally {
    clearTimeout(timer);
  }
}

function mapArgs(
  mapping: Record<string, string>,
  collected: Record<string, unknown>,
  contactName: string | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [target, source] of Object.entries(mapping)) {
    if (source === "contact.name") out[target] = contactName;
    else if (source.startsWith("contact.")) out[target] = undefined;
    else out[target] = collected[source];
  }
  return out;
}

// Minimal JSON-schema check: required keys present and non-null, and declared types match. Returns
// an error string when invalid, or null when the args are acceptable.
function validate(args: Record<string, unknown>, schema: Record<string, unknown>): string | null {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) {
    const v = args[key];
    if (v === null || v === undefined || v === "") return `Missing required field: ${key}`;
  }
  const props = (schema.properties as Record<string, { type?: string }>) ?? {};
  for (const [key, spec] of Object.entries(props)) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    const t = spec.type;
    if (t === "number" && typeof v !== "number") return `Field ${key} must be a number`;
    if (t === "string" && typeof v !== "string") return `Field ${key} must be a string`;
    if (t === "boolean" && typeof v !== "boolean") return `Field ${key} must be a boolean`;
  }
  return null;
}

async function readCapped(res: Response, maxBytes: number): Promise<unknown> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return { truncated: true, bytes: total };
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

function record(
  tenantId: string,
  conversationId: string,
  integrationId: string,
  request: unknown,
  response: unknown,
  status: string,
): Promise<void> {
  return insertIntegrationRun(tenantId, conversationId, integrationId, request, response, status);
}
