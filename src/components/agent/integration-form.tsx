"use client";

import { useActionState, useState } from "react";
import { saveIntegration } from "@/lib/agent/integrations-actions";
import {
  HTTP_METHODS,
  AUTH_TYPES,
  ARG_TYPES,
  type UiArg,
  type IntegrationState,
} from "@/lib/agent/integrations-constants";
import type { IntegrationConfig } from "@/lib/agent/integrations";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function IntegrationForm({ config }: { config: IntegrationConfig }) {
  const [authType, setAuthType] = useState(config.authType);
  const [args, setArgs] = useState<UiArg[]>(config.args);
  const [state, action, pending] = useActionState<IntegrationState, FormData>(saveIntegration, {});

  const setArg = (i: number, patch: Partial<UiArg>) =>
    setArgs((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addArg = () =>
    setArgs((a) => [
      ...a,
      { arg: "", source: config.sourceOptions[0]?.value ?? "", type: "string", required: true },
    ]);
  const removeArg = (i: number) => setArgs((a) => a.filter((_, idx) => idx !== i));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="args" value={JSON.stringify(args)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" hint="Reference this exact name in your qualification rule.">
          <Input name="name" defaultValue={config.name} placeholder="create_beneficiary" required />
        </Field>
        <Field label="Method">
          <Select name="method" defaultValue={config.method}>
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="URL"
        hint="Requests to private or link-local addresses are refused. Use a public endpoint."
      >
        <Input name="url" defaultValue={config.url} placeholder="https://api.yourcrm.com/leads" required />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Authentication">
          <Select name="auth_type" value={authType} onChange={(e) => setAuthType(e.target.value)}>
            {AUTH_TYPES.map((a) => (
              <option key={a} value={a}>
                {a === "none" ? "None" : "Bearer token"}
              </option>
            ))}
          </Select>
        </Field>
        {authType === "bearer" && (
          <Field label="Bearer token" hint="Stored encrypted at rest. Never shown again.">
            <Input
              name="secret"
              type="password"
              autoComplete="off"
              placeholder={config.hasSecret ? "Stored. Leave blank to keep." : "Paste the token"}
            />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Request body arguments</span>
          <span className="text-xs text-muted">Sent as JSON to your endpoint</span>
        </div>
        {args.length === 0 ? (
          <p className="text-sm text-muted">No arguments yet. Add the fields to send to your API.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {args.map((a, i) => (
              <li
                key={i}
                className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border bg-surface/60 p-3 sm:grid-cols-[1fr_1fr_120px_auto_auto]"
              >
                <Input
                  value={a.arg}
                  onChange={(e) => setArg(i, { arg: e.target.value })}
                  placeholder="arg name"
                />
                <Select value={a.source} onChange={(e) => setArg(i, { source: e.target.value })}>
                  {config.sourceOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <Select value={a.type} onChange={(e) => setArg(i, { type: e.target.value })}>
                  {ARG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <Checkbox
                  label="Req"
                  className="px-1"
                  checked={a.required}
                  onChange={(e) => setArg(i, { required: e.target.checked })}
                />
                <Button type="button" variant="outline" onClick={() => removeArg(i)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={addArg}
          className="self-start rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
        >
          Add argument
        </button>
      </div>

      <div className="border-t border-border pt-5">
        <Checkbox name="enabled" label="Integration enabled" defaultChecked={config.enabled} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save integration"}
        </Button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
        {state.error && <span className="text-sm text-foreground">{state.error}</span>}
      </div>
    </form>
  );
}
