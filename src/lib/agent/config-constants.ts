// Shared constants and types for agent configuration. Kept out of the "use server" module,
// which may only export async functions. Safe to import from both client and server.

// NOTE: gemini-2.5-* return 404 ("no longer available to new users") for API keys created after
// Google retired them. They are listed for keys that still have access; new keys must pick a
// -latest alias or a 3.x model (resolved on v1beta, which is what the @google/genai SDK calls).
export const MODELS = [
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
] as const;
export const FIELD_TYPES = ["string", "number", "boolean"] as const;

export interface ConfigState {
  error?: string;
  ok?: boolean;
}
