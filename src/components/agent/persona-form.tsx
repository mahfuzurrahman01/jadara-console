"use client";

import { useActionState } from "react";
import { updateAgentPersona } from "@/lib/agent/config-actions";
import { MODELS, type ConfigState } from "@/lib/agent/config-constants";
import type { AgentConfig } from "@/lib/agent/config";
import { Field } from "@/components/ui/field";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PersonaForm({ agent }: { agent: AgentConfig }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(updateAgentPersona, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Agent name">
          <Input name="name" defaultValue={agent.name} required />
        </Field>
        <Field label="Vertical">
          <Input
            name="vertical"
            defaultValue={agent.vertical}
            placeholder="e.g. Real estate, Lending, Charity"
          />
        </Field>
      </div>

      <Field
        label="Persona / system prompt"
        hint="Do not put secrets or private customer data here. This text is sent to the model on every turn."
      >
        <Textarea
          className="min-h-40"
          name="system_prompt"
          defaultValue={agent.systemPrompt}
          placeholder="Describe how the agent should speak and what it is trying to find out. This is the instruction the AI follows on every reply."
        />
      </Field>

      <Field label="Model" className="max-w-xs">
        <Select name="model" defaultValue={agent.model}>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
        {state.error && <span className="text-sm text-foreground">{state.error}</span>}
      </div>
    </form>
  );
}
