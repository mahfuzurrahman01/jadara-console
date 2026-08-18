"use client";

import { useActionState } from "react";
import { addField, updateField, deleteField } from "@/lib/agent/config-actions";
import type { ConfigState } from "@/lib/agent/config-constants";
import type { FieldRow } from "@/lib/agent/config";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const TYPES = ["string", "number", "boolean"];

export function FieldsManager({ fields }: { fields: FieldRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {fields.length === 0 ? (
        <p className="text-sm text-muted">
          No fields yet. Add the pieces of information the agent should collect from each customer.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((f) => (
            <FieldEditor key={f.id} field={f} />
          ))}
        </ul>
      )}
      <AddField />
    </div>
  );
}

function FieldEditor({ field }: { field: FieldRow }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(updateField, {});

  return (
    <li className="rounded-xl border border-border bg-surface/60 p-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={field.id} />
        <div className="flex items-center justify-between gap-3">
          <code className="rounded bg-surface px-2 py-0.5 font-mono text-xs">{field.key}</code>
          <span className="text-xs text-muted">Key cannot be changed</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Label">
            <Input name="label" defaultValue={field.label} required />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={field.type}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Question hint">
          <Input
            name="question_hint"
            defaultValue={field.questionHint}
            placeholder="How the agent should ask for this"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox name="required" label="Required" defaultChecked={field.required} />
          <div className="ml-auto flex items-center gap-2">
            {state.ok && <span className="text-xs text-muted">Saved.</span>}
            {state.error && <span className="text-xs text-foreground">{state.error}</span>}
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
      <form action={deleteField} className="mt-2 flex justify-end">
        <input type="hidden" name="id" value={field.id} />
        <button type="submit" className="text-xs text-muted hover:text-foreground hover:underline">
          Delete field
        </button>
      </form>
    </li>
  );
}

function AddField() {
  const [state, action, pending] = useActionState<ConfigState, FormData>(addField, {});

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
    >
      <p className="text-sm font-medium">Add a field</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Key">
          <Input name="key" placeholder="monthly_income" required />
        </Field>
        <Field label="Label">
          <Input name="label" placeholder="Monthly income" required />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Type">
          <Select name="type" defaultValue="string">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Question hint">
          <Input name="question_hint" placeholder="How the agent should ask for this" />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <Checkbox name="required" label="Required" defaultChecked />
        <div className="ml-auto flex items-center gap-2">
          {state.error && <span className="text-xs text-foreground">{state.error}</span>}
          <Button type="submit" disabled={pending}>
            {pending ? "Adding..." : "Add field"}
          </Button>
        </div>
      </div>
    </form>
  );
}
