"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register, login, type AuthState } from "@/lib/auth/actions";
import { Field, FormNotice } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function TextField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label}>
      <Input {...props} />
    </Field>
  );
}

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <FormNotice>{error}</FormNotice>;
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Please wait..." : label}
    </Button>
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
        <TextField label="Business name" name="business" placeholder="Acme Realty" required />
        <TextField label="Your name" name="name" placeholder="Full name" autoComplete="name" />
        <TextField label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <TextField
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
        <TextField label="Email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
        <TextField
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
