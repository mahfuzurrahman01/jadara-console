// Shared constants/types for the integration config UI. Plain module (no "use server").

export const HTTP_METHODS = ["POST", "PUT", "PATCH", "GET"] as const;
export const AUTH_TYPES = ["none", "bearer"] as const;
export const ARG_TYPES = ["string", "number", "boolean"] as const;

// One argument in the outgoing request. `source` is where its value comes from: "contact.name" or
// a collected field key. Together the args build both field_mapping and input_schema.
export interface UiArg {
  arg: string;
  source: string;
  type: string;
  required: boolean;
}

export interface IntegrationState {
  error?: string;
  ok?: boolean;
}
