"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export interface AuthState {
  error?: string;
}

function normalizeEmail(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().toLowerCase();
}

// Register a business: creates the user, a tenant, an owner membership, and a blank agent
// the owner will configure next. supabase-js has no multi-statement transaction, so on a
// later failure we best-effort roll back the rows we already created.
export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const businessName = String(formData.get("business") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (businessName.length < 2) return { error: "Enter your business name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const db = supabaseAdmin();

  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return { error: "An account with that email already exists." };

  const password_hash = await hashPassword(password);
  const { data: user, error: userErr } = await db
    .from("users")
    .insert({ email, password_hash, name })
    .select("id")
    .single();
  if (userErr || !user) return { error: "Could not create the account. Try again." };

  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({ name: businessName })
    .select("id")
    .single();
  if (tenantErr || !tenant) {
    await db.from("users").delete().eq("id", user.id);
    return { error: "Could not create the workspace. Try again." };
  }

  const { error: memberErr } = await db
    .from("tenant_members")
    .insert({ tenant_id: tenant.id, user_id: user.id, role: "owner" });
  if (memberErr) {
    await db.from("tenants").delete().eq("id", tenant.id);
    await db.from("users").delete().eq("id", user.id);
    return { error: "Could not finish setup. Try again." };
  }

  // A blank agent so the workspace has something to configure. Persona and rules come next.
  await db.from("agents").insert({
    tenant_id: tenant.id,
    name: `${businessName} agent`,
    system_prompt: "",
  });

  await createSession(user.id);
  redirect("/");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  // Verify against the found hash, or a throwaway compare when the user is missing, so the
  // response time does not reveal whether the email exists.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, "scrypt$16384$00$00").then(() => false);
  if (!user || !ok) return { error: "Invalid email or password." };

  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
