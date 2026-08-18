import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The channel_connections mapping ties an OpenWA session to a tenant's agent. Each tenant gets a
// deterministic session name so re-connecting reuses the same gateway session.

export function sessionNameForTenant(tenantId: string): string {
  return `tenant-${tenantId}`;
}

export interface ChannelConnection {
  externalSessionId: string;
  status: string;
}

export async function getChannelConnection(agentId: string): Promise<ChannelConnection | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("channel_connections")
    .select("external_session_id, status")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { externalSessionId: data.external_session_id, status: data.status };
}

export async function upsertChannelConnection(
  tenantId: string,
  agentId: string,
  sessionId: string,
  status: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("channel_connections").upsert(
    {
      tenant_id: tenantId,
      agent_id: agentId,
      provider: "openwa",
      external_session_id: sessionId,
      status,
    },
    { onConflict: "provider,external_session_id" },
  );
  if (error) throw error;
}

export async function setChannelStatus(sessionId: string, status: string): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("channel_connections")
    .update({ status })
    .eq("provider", "openwa")
    .eq("external_session_id", sessionId);
}
