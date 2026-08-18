import { GoogleGenAI, Type } from "@google/genai";
import { env } from "@/lib/env";
import type { ExtractInput, FieldType, GenerateReplyInput, LLMProvider } from "./types";

const GENAI_TYPE: Record<FieldType, Type> = {
  string: Type.STRING,
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
};

// Reserved key the extraction pass returns alongside the tenant's fields to flag a human-handoff
// request. Exported so the agent loop reads the exact same key.
export const HANDOFF_KEY = "_handoff_requested";

// The free tier is frequently overloaded: the same model/key bounces between 503 (UNAVAILABLE),
// 429 (rate limit), and transient 404 within seconds. A single failed call silently drops the
// customer's WhatsApp reply, so retry transient errors with exponential backoff before giving up.
const RETRYABLE = new Set([429, 500, 503]);

// The @google/genai SDK throws an Error whose `.message` is the raw API JSON, e.g.
// {"error":{"code":503,"status":"UNAVAILABLE",...}}. It may also carry a numeric `.status`.
function statusCode(err: unknown): number | null {
  const e = err as { code?: number; status?: number; message?: string };
  if (typeof e?.code === "number") return e.code;
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.message === "string") {
    const m = e.message.match(/"code"\s*:\s*(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = statusCode(err);
      if (code !== null && !RETRYABLE.has(code)) throw err;
      if (i === attempts - 1) break;
      // The free-tier overload flaps request-to-request, so retry fast with a low, capped backoff
      // plus jitter rather than long exponential waits: 0.4s, 0.7s, 1.3s, 2.5s, then flat ~3s.
      const delay = Math.min(400 * 2 ** i, 2500) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Gemini implementation of LLMProvider using the current @google/genai SDK. Model id comes from
// the agent row (seeded as gemini-flash-latest), not hardcoded here.
class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.requireServer("geminiApiKey") });
  }

  async generateReply(input: GenerateReplyInput): Promise<string> {
    const contents = input.history.map((turn) => ({
      role: turn.role === "agent" ? "model" : "user",
      parts: [{ text: turn.text }],
    }));

    const res = await withRetry(() =>
      this.client.models.generateContent({
        model: input.model,
        contents,
        config: {
          systemInstruction: input.systemPrompt,
          temperature: 0.6,
          // Disable the model's "thinking" phase. On 2.5/3.x flash it adds several seconds of
          // latency for no benefit on a short intake reply, which shows up as a slow WhatsApp turn.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    );

    return (res.text ?? "").trim();
  }

  async extract(
    input: ExtractInput,
  ): Promise<Record<string, string | number | boolean | null>> {
    if (input.fields.length === 0) return {};

    // A nullable property per field; null means "the user has not stated this".
    const properties: Record<string, { type: Type; nullable: boolean; description: string }> = {};
    for (const f of input.fields) {
      properties[f.key] = {
        type: GENAI_TYPE[f.type],
        nullable: true,
        description: f.hint ?? f.label,
      };
    }

    // Reserved, underscore-prefixed so it can never collide with a tenant field key (those must
    // start with a letter). Piggybacks human-handoff detection on the extraction call so it costs
    // no extra request. Read by the agent loop; never merged into collected_data.
    properties[HANDOFF_KEY] = {
      type: Type.BOOLEAN,
      nullable: true,
      description:
        "true only if the customer is explicitly asking to speak with a real person, a human " +
        "agent, a manager, the management, or the business directly, or to be called by a person. " +
        "Otherwise false.",
    };

    const transcript = input.history
      .map((t) => `${t.role === "agent" ? "Assistant" : "Customer"}: ${t.text}`)
      .join("\n");

    const res = await withRetry(() =>
      this.client.models.generateContent({
        model: input.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Extract the following fields from this conversation. Use only what the customer " +
                  "has explicitly stated. If a field has not been stated, return null for it. Do not " +
                  "guess or infer beyond what was said.\n\nConversation:\n" +
                  transcript,
              },
            ],
          },
        ],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties,
          },
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    );

    try {
      const parsed = JSON.parse(res.text ?? "{}") as Record<
        string,
        string | number | boolean | null
      >;
      return parsed;
    } catch {
      return {};
    }
  }
}

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (!cached) cached = new GeminiProvider();
  return cached;
}
