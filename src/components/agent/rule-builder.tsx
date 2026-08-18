"use client";

import { useActionState, useState } from "react";
import { saveRule } from "@/lib/agent/rules-actions";
import {
  OPERATORS,
  LOGICS,
  type UiCondition,
  type RuleState,
} from "@/lib/agent/rules-constants";
import type { RuleConfig } from "@/lib/agent/rules";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RuleBuilder({ config }: { config: RuleConfig }) {
  const [logic, setLogic] = useState(config.logic);
  const [conditions, setConditions] = useState<UiCondition[]>(
    config.conditions.length > 0
      ? config.conditions
      : [{ field: config.fieldOptions[0]?.key ?? "", op: ">=", value: "" }],
  );
  const [state, action, pending] = useActionState<RuleState, FormData>(saveRule, {});

  const setCond = (i: number, patch: Partial<UiCondition>) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCond = () =>
    setConditions((cs) => [...cs, { field: config.fieldOptions[0]?.key ?? "", op: ">=", value: "" }]);
  const removeCond = (i: number) => setConditions((cs) => cs.filter((_, idx) => idx !== i));

  const needsList = (op: string) => op === "in" || op === "not_in";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="conditions" value={JSON.stringify(conditions)} />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted">A customer qualifies when</span>
        <div className="flex items-center gap-2 text-sm">
          <select
            name="logic"
            value={logic}
            onChange={(e) => setLogic(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LOGICS.map((l) => (
              <option key={l} value={l}>
                {l === "AND" ? "ALL of these are true" : "ANY of these is true"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {conditions.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <select
              className={inputCls}
              value={c.field}
              onChange={(e) => setCond(i, { field: e.target.value })}
            >
              {config.fieldOptions.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={c.op}
              onChange={(e) => setCond(i, { op: e.target.value })}
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              className={inputCls}
              value={c.value}
              onChange={(e) => setCond(i, { value: e.target.value })}
              placeholder={needsList(c.op) ? "comma, separated, list" : "value"}
            />
            <button
              type="button"
              onClick={() => removeCond(i)}
              disabled={conditions.length === 1}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addCond}
        className="self-start rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
      >
        Add condition
      </button>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <span className="text-xs font-medium text-muted">When a customer qualifies</span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked={config.notify} />
          Notify the workspace owner
        </label>
        <label className="flex max-w-sm flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Run integration (by name, optional)</span>
          <input
            className={inputCls}
            name="integration"
            defaultValue={config.integration}
            placeholder="e.g. create_beneficiary"
          />
          <span className="text-xs text-muted">
            Configure the integration itself on the Integrations page.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save rule"}
        </button>
        {state.ok && <span className="text-sm text-muted">Saved.</span>}
        {state.error && <span className="text-sm text-foreground">{state.error}</span>}
      </div>
    </form>
  );
}
