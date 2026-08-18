"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register, login, type AuthState } from "@/lib/auth/actions";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input className={inputCls} {...props} />
    </label>
  );
}

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
      {error}
    </p>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Please wait..." : label}
    </button>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, {});
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted">
          Register your business to set up your WhatsApp qualification agent.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <Field label="Business name" name="business" placeholder="Acme Realty" required />
        <Field label="Your name" name="name" placeholder="Full name" autoComplete="name" />
        <Field label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <ErrorNote error={state.error} />
        <Submit pending={pending} label="Create workspace" />
      </form>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Welcome back. Enter your details to continue.</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <Field label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          required
        />
        <ErrorNote error={state.error} />
        <Submit pending={pending} label="Sign in" />
      </form>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Create a workspace
        </Link>
      </p>
    </div>
  );
}
