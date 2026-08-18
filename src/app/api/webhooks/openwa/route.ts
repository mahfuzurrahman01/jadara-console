import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { env } from "@/lib/env";
import { processInboundMessage } from "@/lib/agent/process";
import { verifyOpenwaSignature } from "@/lib/webhooks/verify";
import type { OpenwaWebhookEnvelope } from "@/lib/webhooks/openwa-types";
import {
  resolveChannel,
  updateChannelStatus,
  findOrCreateContact,
  getOrCreateOpenConversation,
  insertInboundMessage,
} from "@/lib/repo/ingest";

// OpenWA webhook receiver.
// Slice 3: verify the HMAC signature, resolve the session to a tenant/agent, and persist the
// inbound message (contact -> conversation -> message). Returns 200 fast; never logs PII or bodies.

export const runtime = "nodejs";

// WhatsApp message types we treat as plain text for the intake flow.
const TEXT_TYPES = new Set(["text", "chat"]);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-openwa-signature");

  if (!verifyOpenwaSignature(raw, signature, env.requireServer("openwaWebhookSecret"))) {
    console.warn("[openwa webhook] rejected: bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: OpenwaWebhookEnvelope;
  try {
    body = JSON.parse(raw) as OpenwaWebhookEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, sessionId, data } = body;
  if (!sessionId) {
    return NextResponse.json({ ok: true, skipped: "no sessionId" }, { status: 200 });
  }

  try {
    if (event === "session.status") {
      if (data?.status) await updateChannelStatus(sessionId, data.status);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (event === "message.received") {
      const skip = inboundSkipReason(data);
      if (skip) {
        return NextResponse.json({ ok: true, skipped: skip }, { status: 200 });
      }

      const channel = await resolveChannel(sessionId);
      if (!channel) {
        console.warn("[openwa webhook] no channel mapping for session");
        return NextResponse.json({ ok: true, skipped: "unknown session" }, { status: 200 });
      }

      const msg = data!;
      const name =
        msg.contact?.pushname || msg.contact?.name || msg.contact?.formattedName || null;
      const contactId = await findOrCreateContact(channel.tenantId, msg.from, name);
      const conversationId = await getOrCreateOpenConversation(
        channel.tenantId,
        channel.agentId,
        contactId,
      );
      const { inserted } = await insertInboundMessage(channel.tenantId, conversationId, {
        type: "text",
        content: msg.body,
        externalMessageId: msg.id ?? null,
      });

      console.log("[openwa webhook] inbound persisted", { conversationId, inserted });

      // Only act on genuinely new inbound messages; a retry (inserted=false) must not re-reply.
      // Run the agent AFTER the 200 response so the webhook stays fast and OpenWA does not retry
      // on a slow LLM call. Kept isolated so a queue can replace `after` later.
      if (inserted) {
        after(async () => {
          try {
            await processInboundMessage(conversationId);
          } catch (err) {
            console.error("[agent] processing failed", (err as Error)?.message);
          }
        });
      }

      return NextResponse.json({ ok: true, conversationId }, { status: 200 });
    }

    // Any other event: acknowledge without acting.
    return NextResponse.json({ ok: true, ignored: event ?? "unknown" }, { status: 200 });
  } catch (err) {
    // Return 500 so OpenWA retries a transient failure; do not surface details.
    console.error("[openwa webhook] processing error", (err as Error)?.message);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

// Decide whether an inbound message should be dropped before we touch the database. Returns a
// short reason string to skip, or null to persist. Filters out our own sends, group/status
// traffic, non-text types, and the empty frames from the connect-time history sync.
function inboundSkipReason(data: OpenwaWebhookEnvelope["data"]): string | null {
  if (!data) return "no data";
  if (data.fromMe) return "outbound echo";
  if (data.isGroup) return "group";
  if (data.isStatusBroadcast) return "status broadcast";
  if (!data.from) return "no sender";
  if (!TEXT_TYPES.has(data.type)) return `type ${data.type}`;
  if (!data.body || data.body.trim().length === 0) return "empty body";
  return null;
}
