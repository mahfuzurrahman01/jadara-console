import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth/dal";
import {
  ensureSession,
  registerWebhook,
  isPublicWebhookUrl,
  GatewayError,
} from "@/lib/channel/openwa-admin";
import { sessionNameForTenant, upsertChannelConnection } from "@/lib/channel/connection";

// Starts (or reuses) this tenant's WhatsApp session and registers the webhook. The browser then
// polls /api/channel/status for the QR and link state.
export async function POST() {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.agentId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const name = sessionNameForTenant(tenant.tenantId);
    const sid = await ensureSession(name);
    await registerWebhook(sid);
    await upsertChannelConnection(tenant.tenantId, tenant.agentId, sid, "linking");

    return NextResponse.json({
      ok: true,
      status: "linking",
      warning: isPublicWebhookUrl()
        ? undefined
        : "The app public URL points at localhost, so the gateway cannot deliver messages. Set APP_PUBLIC_URL to a public tunnel.",
    });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Could not start the WhatsApp session." }, { status: 500 });
  }
}
