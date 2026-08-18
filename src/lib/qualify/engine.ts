// Deterministic qualification engine. No LLM: given collected_data and a tenant's rule, decide
// qualified / not_qualified / pending, and return a per-condition audit trail. Incomplete data
// yields pending unless the present conditions already make the outcome certain.

export type Operator = "<" | "<=" | ">" | ">=" | "==" | "!=" | "in" | "not_in";
export type Logic = "AND" | "OR";
export type QualStatus = "qualified" | "not_qualified" | "pending";

export interface Condition {
  field: string;
  op: Operator;
  value: unknown;
}

export interface Rule {
  logic: Logic;
  conditions: Condition[];
}

export interface ConditionResult {
  field: string;
  op: Operator;
  value: unknown;
  actual: unknown;
  // "pass" | "fail" when the field is present and comparable; "missing" when not yet collected.
  outcome: "pass" | "fail" | "missing";
}

export interface QualResult {
  status: QualStatus;
  matched: ConditionResult[];
}

export function evaluateRule(rule: Rule, data: Record<string, unknown>): QualResult {
  const matched: ConditionResult[] = rule.conditions.map((c) => {
    const actual = data[c.field];
    const outcome = isMissing(actual) ? "missing" : compare(actual, c.op, c.value) ? "pass" : "fail";
    return { field: c.field, op: c.op, value: c.value, actual, outcome };
  });

  const anyPass = matched.some((m) => m.outcome === "pass");
  const anyFail = matched.some((m) => m.outcome === "fail");
  const anyMissing = matched.some((m) => m.outcome === "missing");
  const allPass = matched.every((m) => m.outcome === "pass");
  const allFail = matched.every((m) => m.outcome === "fail");

  let status: QualStatus;
  if (rule.logic === "AND") {
    // Any present failure already breaks the AND (certain not_qualified). Otherwise need every
    // condition to pass; a missing one keeps it pending.
    if (anyFail) status = "not_qualified";
    else if (allPass) status = "qualified";
    else status = "pending";
  } else {
    // OR: any present pass already satisfies it (certain qualified). Otherwise every condition must
    // be present and failing to conclude not_qualified; a missing one keeps it pending.
    if (anyPass) status = "qualified";
    else if (allFail && !anyMissing) status = "not_qualified";
    else status = "pending";
  }

  return { status, matched };
}

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function compare(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const a = Number(actual);
      const b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (op === "<") return a < b;
      if (op === "<=") return a <= b;
      if (op === ">") return a > b;
      return a >= b;
    }
    case "==":
      return equals(actual, expected);
    case "!=":
      return !equals(actual, expected);
    case "in":
      return Array.isArray(expected) && expected.some((e) => equals(actual, e));
    case "not_in":
      return Array.isArray(expected) && !expected.some((e) => equals(actual, e));
    default:
      return false;
  }
}

// Loose equality that is case-insensitive for strings (district names, yes/no) and exact for
// numbers/booleans.
function equals(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}
