import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Database-backed sessions. The cookie carries an opaque random token; the database stores
// only its SHA-256 hash. Looking a session up hashes the incoming token and matches the row,
// so a leaked database never yields a usable cookie.

const COOKIE = "wa_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  const db = supabaseAdmin();
  await db.from("user_sessions").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// Returns the user id for the current valid session, or null. Expired sessions are treated
// as absent (and swept lazily on logout / next login).
export async function readSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const db = supabaseAdmin();
  const { data } = await db
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const db = supabaseAdmin();
    await db.from("user_sessions").delete().eq("token_hash", hashToken(token));
  }
  store.delete(COOKIE);
}
