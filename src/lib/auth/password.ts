import "server-only";
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// Password hashing with Node's built-in scrypt. No external dependency.
// Stored format: scrypt$N$saltHex$hashHex. The salt is per-password; comparison is
// constant-time. If the parameters ever change, the prefix lets us detect and rehash.

// promisify picks the option-less overload; retype it so the cost parameter is allowed.
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;
const KEYLEN = 64;
const COST = 16384; // scrypt N (CPU/memory cost). Kept in the stored string for forward compat.

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(plain, salt, KEYLEN, { N: COST })) as Buffer;
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) return false;

  const derived = (await scrypt(plain, salt, expected.length, { N: cost })) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
