import "server-only";
import { env } from "@/lib/env";

// Thin server-side client for the OpenWA management API. Uses the master API key and is only ever
// called from route handlers, never the browser. The gateway may be unreachable (Docker down); the
// caller is expected to handle a thrown GatewayError.

export class GatewayError extends Error {}

interface ApiResult {
  status: number;
  ok: boolean;
  body: unknown;
}

async function api(path: string, init: RequestInit = {}): Promise<ApiResult> {
  const base = env.requireServer("openwaBaseUrl");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "X-API-Key": env.requireServer("openwaApiKey"),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new GatewayError("The WhatsApp gateway is not reachable. Make sure it is running.");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

interface Session {
  id: string;
  name: string;
  status: string;
  phone?: string;
}

// OpenWA reports a linked/live session with any of these statuses (it uses "ready" once a number
// is paired and working). Anything else means it still needs the QR scanned.
const CONNECTED_STATUSES = new Set(["connected", "authenticated", "ready", "working", "online"]);

export function isConnectedStatus(status: string): boolean {
  return CONNECTED_STATUSES.has(status.toLowerCase());
}

async function findSessionByName(name: string): Promise<Session | null> {
  const r = await api("/sessions");
  if (Array.isArray(r.body)) {
    return (r.body as Session[]).find((s) => s.name === name) ?? null;
  }
  return null;
}

// Create-or-reuse a session by name and start it. Returns the session id.
export async function ensureSession(name: string): Promise<string> {
  let session = await findSessionByName(name);
  if (!session) {
    const created = await api("/sessions", { method: "POST", body: JSON.stringify({ name }) });
    if (created.status === 409) {
      session = await findSessionByName(name);
    } else if (created.ok) {
      session = created.body as Session;
    }
    if (!session) throw new GatewayError("Could not create a WhatsApp session.");
  }
  const sid = session.id;
  // start is idempotent-ish: a 400 means already started/authenticated.
  await api(`/sessions/${sid}/start`, { method: "POST" });
  return sid;
}

export interface SessionState {
  status: string;
  phone: string | null;
  qr: string | null;
}

export async function getSessionState(sid: string): Promise<SessionState> {
  const s = await api(`/sessions/${sid}`);
  const body = (s.body as Session) ?? null;
  const status = body?.status ?? "unknown";
  const phone = body?.phone ?? null;

  // Only fetch a QR while it still needs linking.
  let qr: string | null = null;
  if (!isConnectedStatus(status)) {
    const q = await api(`/sessions/${sid}/qr`);
    const qc = (q.body as { qrCode?: string })?.qrCode;
    if (typeof qc === "string" && qc.startsWith("data:image")) qr = qc;
  }
  return { status, phone, qr };
}

// Register our webhook, replacing any existing registration for the same URL so re-connecting stays
// clean. The webhook endpoint resolves the session to a tenant, so a single shared secret is fine.
export async function registerWebhook(sid: string): Promise<void> {
  const webhookUrl = `${env.appPublicUrl.replace(/\/$/, "")}/api/webhooks/openwa`;
  const existing = await api(`/sessions/${sid}/webhooks`);
  if (Array.isArray(existing.body)) {
    for (const w of existing.body as { id: string; url: string }[]) {
      if (w.url === webhookUrl) await api(`/sessions/${sid}/webhooks/${w.id}`, { method: "DELETE" });
    }
  }
  await api(`/sessions/${sid}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url: webhookUrl,
      events: ["message.received", "session.status"],
      secret: env.requireServer("openwaWebhookSecret"),
    }),
  });
}

export function isPublicWebhookUrl(): boolean {
  const u = env.appPublicUrl;
  return !!u && !u.includes("localhost") && !u.includes("127.0.0.1");
}
