// OpenWA session bootstrap for the demo.
// Creates (or reuses) a session, starts it, shows the QR to link a throwaway number,
// waits for it to connect, registers our webhook, and records the channel_connection
// mapping (session -> Amanah tenant/agent) in Supabase.
//
// Run with env loaded:
//   set -a; . ./.env.local; set +a; node scripts/openwa-setup.mjs
//
// Required env: OPENWA_BASE_URL, OPENWA_API_KEY, OPENWA_SESSION_ID (session name),
//               OPENWA_WEBHOOK_SECRET, APP_PUBLIC_URL, SUPABASE_DB_URL

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.OPENWA_BASE_URL || "http://localhost:2785/api";
const API_KEY = need("OPENWA_API_KEY");
const SESSION_NAME = process.env.OPENWA_SESSION_ID || "amanah-demo";
const WEBHOOK_SECRET = need("OPENWA_WEBHOOK_SECRET");
const APP_PUBLIC_URL = need("APP_PUBLIC_URL");
const WEBHOOK_URL = `${APP_PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/openwa`;

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findSessionByName(name) {
  const r = await api("/sessions");
  if (Array.isArray(r.body)) return r.body.find((s) => s.name === name) || null;
  return null;
}

async function main() {
  console.log(`OpenWA base: ${BASE}`);
  console.log(`Session name: ${SESSION_NAME}`);
  console.log(`Webhook URL:  ${WEBHOOK_URL}\n`);

  if (WEBHOOK_URL.includes("localhost") || WEBHOOK_URL.includes("127.0.0.1")) {
    console.warn(
      "WARNING: APP_PUBLIC_URL points at localhost. OpenWA runs in Docker and cannot reach your host's localhost, and its SSRF guard may reject private URLs. Use a tunnel (cloudflared/ngrok) and set APP_PUBLIC_URL to the public URL.\n",
    );
  }

  // 1. Create or reuse session
  let session = await findSessionByName(SESSION_NAME);
  if (!session) {
    const created = await api("/sessions", {
      method: "POST",
      body: JSON.stringify({ name: SESSION_NAME }),
    });
    if (created.status === 409) {
      session = await findSessionByName(SESSION_NAME);
    } else if (created.ok) {
      session = created.body;
      console.log(`Created session ${session.id}`);
    } else {
      console.error("Create session failed:", created.status, created.body);
      process.exit(1);
    }
  } else {
    console.log(`Reusing session ${session.id} (status: ${session.status})`);
  }
  const sid = session.id;

  // 2. Start session (idempotent-ish: 400 if already started/authenticated)
  const started = await api(`/sessions/${sid}/start`, { method: "POST" });
  if (!started.ok && started.status !== 400) {
    console.error("Start failed:", started.status, started.body);
  }

  // 3. Record the channel_connection mapping now (before linking)
  await upsertChannelConnection(sid);

  // 4. Poll for QR, or detect already-connected
  let linked = false;
  for (let i = 0; i < 60; i++) {
    const s = await api(`/sessions/${sid}`);
    const status = s.body?.status;
    if (status === "connected" || status === "authenticated") {
      console.log(`\nSession is ${status}. Number already linked.`);
      linked = true;
      break;
    }
    const qr = await api(`/sessions/${sid}/qr`);
    if (qr.ok && qr.body?.qrCode?.startsWith("data:image")) {
      writeQr(qr.body.qrCode);
      console.log("\nScan the QR window with the throwaway WhatsApp number now.");
      console.log("Waiting for the link to complete...");
      // now wait for connect
      for (let j = 0; j < 120; j++) {
        const s2 = await api(`/sessions/${sid}`);
        if (s2.body?.status === "connected" || s2.body?.status === "authenticated") {
          console.log(`\nLinked. Session status: ${s2.body.status}`);
          linked = true;
          break;
        }
        await sleep(2000);
      }
      break;
    }
    await sleep(2000);
  }

  if (!linked) {
    console.warn("\nDid not observe a connected status. Continuing to register the webhook anyway.");
  }

  // 5. Register webhook (replace any existing one for a clean state)
  await registerWebhook(sid);

  console.log("\nSetup done. Send a WhatsApp message to the linked number and watch the app logs.");
  process.exit(0);
}

async function registerWebhook(sid) {
  const existing = await api(`/sessions/${sid}/webhooks`);
  if (Array.isArray(existing.body)) {
    for (const w of existing.body) {
      if (w.url === WEBHOOK_URL) {
        await api(`/sessions/${sid}/webhooks/${w.id}`, { method: "DELETE" });
      }
    }
  }
  const r = await api(`/sessions/${sid}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url: WEBHOOK_URL,
      events: ["message.received", "session.status"],
      secret: WEBHOOK_SECRET,
    }),
  });
  if (r.ok) {
    console.log(`Registered webhook ${r.body.id} -> ${WEBHOOK_URL}`);
  } else {
    console.error("Webhook registration failed:", r.status, r.body);
    if (r.status === 400) {
      console.error(
        "A 400 here is usually the SSRF guard rejecting a private/localhost URL. Use a public tunnel URL in APP_PUBLIC_URL.",
      );
    }
  }
}

async function upsertChannelConnection(sid) {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.warn("SUPABASE_DB_URL not set; skipping channel_connection mapping.");
    return;
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select a.id as agent_id, a.tenant_id
         from agents a
         join tenants t on t.id = a.tenant_id
        where t.name = 'Amanah Foundation'
        limit 1`,
    );
    if (rows.length === 0) {
      console.warn("Amanah agent not found; run migrations/seed first. Skipping mapping.");
      return;
    }
    const { agent_id, tenant_id } = rows[0];
    await client.query(
      `insert into channel_connections (tenant_id, agent_id, provider, external_session_id, status)
       values ($1, $2, 'openwa', $3, 'linking')
       on conflict (provider, external_session_id)
       do update set status = 'linking', tenant_id = excluded.tenant_id, agent_id = excluded.agent_id`,
      [tenant_id, agent_id, sid],
    );
    console.log(`Mapped session ${sid} -> Amanah agent ${agent_id}`);
  } finally {
    await client.end();
  }
}

function writeQr(dataUrl) {
  const b64 = dataUrl.split(",")[1];
  const out = join(__dirname, "..", "openwa-qr.png");
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`QR written to ${out}`);
  // Best-effort open on macOS
  try {
    spawn("open", [out], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* ignore */
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
