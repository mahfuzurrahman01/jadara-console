import { env } from "@/lib/env";
import type { ChannelProvider } from "./types";

// OpenWA implementation of ChannelProvider. Talks to the self-hosted gateway's REST API:
//   POST {base}/sessions/{sessionId}/messages/send-text  -> 201 { messageId, timestamp }
// Auth is the master/operator API key via the X-API-Key header.
class OpenWAProvider implements ChannelProvider {
  readonly name = "openwa";

  async sendText(
    sessionId: string,
    chatId: string,
    text: string,
  ): Promise<{ messageId: string }> {
    const base = env.openwaBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/sessions/${sessionId}/messages/send-text`, {
      method: "POST",
      headers: {
        "X-API-Key": env.requireServer("openwaApiKey"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatId, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenWA send-text failed: ${res.status} ${detail.slice(0, 200)}`);
    }
    const body = (await res.json()) as { messageId?: string };
    return { messageId: body.messageId ?? "" };
  }
}

let cached: ChannelProvider | null = null;

// Factory so agent code depends on the interface, not the concrete provider. Swap here to add a
// Cloud API provider later.
export function getChannelProvider(): ChannelProvider {
  if (!cached) cached = new OpenWAProvider();
  return cached;
}
