import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { getSecret, putSecret } from "@/lib/repo/ingest";

// Integration credentials are encrypted at rest (AES-256-GCM). The master key comes from
// SECRETS_ENCRYPTION_KEY; we hash it to a fixed 32 bytes so any key length/encoding works. The
// 12-byte IV is random per encryption and stored alongside; the 16-byte GCM auth tag is appended to
// the ciphertext. Nothing here is ever logged.

function masterKey(): Buffer {
  return createHash("sha256").update(env.requireServer("secretsEncryptionKey")).digest();
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]).toString("hex"), iv: iv.toString("hex") };
}

export function decryptSecret(ciphertextHex: string, ivHex: string): string {
  const buf = Buffer.from(ciphertextHex, "hex");
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// Resolve an integration's auth secret by its ref (the secret key name). Reads the encrypted value
// from the secrets table. For the demo, if a secret is not provisioned yet but a same-named env var
// holds the value, we encrypt and store it once (bootstrap), then return it. Returns null when no
// value is available anywhere.
export async function resolveSecret(tenantId: string, ref: string): Promise<string | null> {
  const stored = await getSecret(tenantId, ref);
  if (stored) return decryptSecret(stored.ciphertext, stored.iv);

  const fromEnv = process.env[ref];
  if (fromEnv && fromEnv.length > 0) {
    const { ciphertext, iv } = encryptSecret(fromEnv);
    await putSecret(tenantId, ref, ciphertext, iv);
    return fromEnv;
  }
  return null;
}
