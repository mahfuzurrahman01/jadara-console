"use client";

import { useActionState } from "react";
import { updateAgentPersona } from "@/lib/agent/config-actions";
import { MODELS, type ConfigState } from "@/lib/agent/config-constants";
import type { AgentConfig } from "@/lib/agent/config";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PersonaForm({ agent }: { agent: AgentConfig }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(updateAgentPersona, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Agent name</span>
          <input className={inputCls} name="name" defaultValue={agent.name} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Vertical</span>
          <input
            className={inputCls}
            name="vertical"
            defaultValue={agent.vertical}
            placeholder="e.g. Real estate, Lending, Charity"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Persona / system prompt</span>
        <textarea
          className={`${inputCls} min-h-40 resize-y leading-relaxed`}
          name="system_prompt"
          defaultValue={agent.systemPrompt}
          placeholder="Describe how the agent should speak and what it is trying to find out. This is the instruction the AI follows on every reply."
        />
        <span className="text-xs text-muted">
          Do not put secrets or private customer data here. This text is sent to the model on every turn.
        </span>
      </label>

      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Model</span>
        <select className={inputCls} name="model" defaultValue={agent.model}>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
        {state.error && <span className="text-sm text-foreground">{state.error}</span>}
      </div>
    </form>
  );
}
