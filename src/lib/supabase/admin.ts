import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client. Bypasses RLS. Server-side ONLY (webhook, agent, jobs).
// Never import this into a client component or expose the key to the browser.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = env.requireServer("supabaseUrl");
  const key = env.requireServer("supabaseServiceRoleKey");
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
