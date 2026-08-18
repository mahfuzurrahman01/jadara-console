import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth/dal";
import { getSessionState, isConnectedStatus, GatewayError } from "@/lib/channel/openwa-admin";
import { getChannelConnection, setChannelStatus } from "@/lib/channel/connection";

// Live link state for the tenant's WhatsApp session. Returns a normalized status plus a QR while
// linking. Polled by the connect page.
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant || !tenant.agentId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const conn = await getChannelConnection(tenant.agentId);
  if (!conn) {
    return NextResponse.json({ status: "disconnected", connected: false });
  }

  try {
    const state = await getSessionState(conn.externalSessionId);
    const connected = isConnectedStatus(state.status);
    const normalized = connected ? "connected" : "linking";
    if (conn.status !== normalized) await setChannelStatus(conn.externalSessionId, normalized);

    return NextResponse.json({
      status: normalized,
      connected,
      phone: state.phone,
      qr: connected ? null : state.qr,
    });
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ status: "unreachable", connected: false, error: err.message });
    }
    return NextResponse.json({ error: "Could not read the session status." }, { status: 500 });
  }
}
