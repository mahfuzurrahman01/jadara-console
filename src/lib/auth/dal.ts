import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readSession } from "@/lib/auth/session";

// Data access layer: the single place that turns a session cookie into a user + tenant.
// Every dashboard query and server action resolves the tenant through here, so tenant
// isolation never depends on a value passed in from the caller. cache() dedupes the lookup
// within a single render pass.

export interface CurrentTenant {
  userId: string;
  email: string;
  userName: string;
  tenantId: string;
  tenantName: string;
  agentId: string | null;
}

export const getCurrentTenant = cache(async (): Promise<CurrentTenant | null> => {
  const userId = await readSession();
  if (!userId) return null;

  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, email, name")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id, tenants(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const tenantName =
    (Array.isArray(membership.tenants)
      ? membership.tenants[0]?.name
      : (membership.tenants as { name?: string } | null)?.name) ?? "";

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email,
    userName: user.name,
    tenantId: membership.tenant_id,
    tenantName,
    agentId: agent?.id ?? null,
  };
});

// Use in protected pages, layouts, and server actions. Redirects to /login when there is no
// valid session, otherwise returns the resolved tenant. This is the real gate.
export async function requireTenant(): Promise<CurrentTenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  return tenant;
}
