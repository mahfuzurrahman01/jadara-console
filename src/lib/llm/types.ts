// LLMProvider abstracts the chat model (Gemini today) so it can be swapped later. Agent code
// depends only on this interface. Slice 4 needs reply generation; extraction (structured output)
// lands in Slice 5.

export type ChatRole = "user" | "agent";

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface GenerateReplyInput {
  model: string;
  systemPrompt: string;
  history: ChatTurn[];
}

export type FieldType = "string" | "number" | "boolean";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  hint: string | null;
}

export interface ExtractInput {
  model: string;
  fields: FieldSpec[];
  history: ChatTurn[];
}

export interface LLMProvider {
  readonly name: string;
  // Generate the next agent reply given the system prompt and prior turns. The latest user turn is
  // the last item in history.
  generateReply(input: GenerateReplyInput): Promise<string>;
  // Structured-output pass: read the conversation and return a value for each field the user has
  // explicitly stated. Fields not stated are returned as null. Never guesses.
  extract(input: ExtractInput): Promise<Record<string, string | number | boolean | null>>;
}
