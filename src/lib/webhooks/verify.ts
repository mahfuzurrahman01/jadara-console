import { createHmac, timingSafeEqual } from "node:crypto";

// OpenWA signs each webhook body as: X-OpenWA-Signature: sha256=<hex(HMAC-SHA256(secret, rawBody))>.
// We must verify over the EXACT raw bytes OpenWA sent, before any JSON parse or re-serialize.
export function verifyOpenwaSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false;

  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;

  // timingSafeEqual throws on length mismatch, so gate on length first (a length difference
  // already means the signature is wrong; comparing as hex strings keeps both sides equal width).
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
