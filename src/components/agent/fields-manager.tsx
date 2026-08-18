"use client";

import { useActionState } from "react";
import { addField, updateField, deleteField } from "@/lib/agent/config-actions";
import type { ConfigState } from "@/lib/agent/config-constants";
import type { FieldRow } from "@/lib/agent/config";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
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
          <code className="rounded bg-surface px-2 py-0.5 text-xs">{field.key}</code>
          <span className="text-xs text-muted">Key cannot be changed</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Label</span>
            <input className={inputCls} name="label" defaultValue={field.label} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Type</span>
            <select className={inputCls} name="type" defaultValue={field.type}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Question hint</span>
          <input
            className={inputCls}
            name="question_hint"
            defaultValue={field.questionHint}
            placeholder="How the agent should ask for this"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" defaultChecked={field.required} />
            Required
          </label>
          <div className="ml-auto flex items-center gap-2">
            {state.ok && <span className="text-xs text-muted">Saved.</span>}
            {state.error && <span className="text-xs text-foreground">{state.error}</span>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
      <form action={deleteField} className="mt-2 flex justify-end">
        <input type="hidden" name="id" value={field.id} />
        <button
          type="submit"
          className="text-xs text-muted hover:text-foreground hover:underline"
        >
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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Key</span>
          <input className={inputCls} name="key" placeholder="monthly_income" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Label</span>
          <input className={inputCls} name="label" placeholder="Monthly income" required />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Type</span>
          <select className={inputCls} name="type" defaultValue="string">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Question hint</span>
          <input
            className={inputCls}
            name="question_hint"
            placeholder="How the agent should ask for this"
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required" defaultChecked />
          Required
        </label>
        <div className="ml-auto flex items-center gap-2">
          {state.error && <span className="text-xs text-foreground">{state.error}</span>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Adding..." : "Add field"}
          </button>
        </div>
      </div>
    </form>
  );
}
