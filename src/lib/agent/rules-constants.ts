// Shared constants/types for the qualification rule builder. Plain module (no "use server"),
// safe to import from client and server.

export const OPERATORS = [
  { value: "<", label: "less than" },
  { value: "<=", label: "at most" },
  { value: ">", label: "greater than" },
  { value: ">=", label: "at least" },
  { value: "==", label: "equals" },
  { value: "!=", label: "not equal to" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
] as const;

export const OPERATOR_VALUES = OPERATORS.map((o) => o.value);
export const LOGICS = ["AND", "OR"] as const;

// A condition as edited in the form. value is always a string here; the server coerces it to the
// field's type (and splits "in"/"not_in" on commas) before storing.
export interface UiCondition {
  field: string;
  op: string;
  value: string;
}

export interface RuleState {
  error?: string;
  ok?: boolean;
}
