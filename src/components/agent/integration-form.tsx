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

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Name</span>
          <input className={inputCls} name="name" defaultValue={config.name} placeholder="create_beneficiary" required />
          <span className="text-xs text-muted">Reference this exact name in your qualification rule.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Method</span>
          <select className={inputCls} name="method" defaultValue={config.method}>
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">URL</span>
        <input className={inputCls} name="url" defaultValue={config.url} placeholder="https://api.yourcrm.com/leads" required />
        <span className="text-xs text-muted">
          Requests to private or link-local addresses are refused. Use a public endpoint.
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Authentication</span>
          <select
            className={inputCls}
            name="auth_type"
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
          >
            {AUTH_TYPES.map((a) => (
              <option key={a} value={a}>
                {a === "none" ? "None" : "Bearer token"}
              </option>
            ))}
          </select>
        </label>
        {authType === "bearer" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Bearer token</span>
            <input
              className={inputCls}
              name="secret"
              type="password"
              autoComplete="off"
              placeholder={config.hasSecret ? "Stored. Leave blank to keep." : "Paste the token"}
            />
            <span className="text-xs text-muted">Stored encrypted at rest. Never shown again.</span>
          </label>
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
                className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface/60 p-3 sm:grid-cols-[1fr_1fr_120px_auto_auto]"
              >
                <input
                  className={inputCls}
                  value={a.arg}
                  onChange={(e) => setArg(i, { arg: e.target.value })}
                  placeholder="arg name"
                />
                <select className={inputCls} value={a.source} onChange={(e) => setArg(i, { source: e.target.value })}>
                  {config.sourceOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select className={inputCls} value={a.type} onChange={(e) => setArg(i, { type: e.target.value })}>
                  {ARG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 px-1 text-sm">
                  <input
                    type="checkbox"
                    checked={a.required}
                    onChange={(e) => setArg(i, { required: e.target.checked })}
                  />
                  Req
                </label>
                <button
                  type="button"
                  onClick={() => removeArg(i)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  Remove
                </button>
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

      <label className="flex items-center gap-2 border-t border-border pt-5 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
        Integration enabled
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save integration"}
        </button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
        {state.error && <span className="text-sm text-foreground">{state.error}</span>}
      </div>
    </form>
  );
}
