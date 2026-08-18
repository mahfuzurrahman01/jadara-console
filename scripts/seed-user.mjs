// Creates a login for an EXISTING tenant (by name) so a seeded workspace stays reachable
// after auth is added. Mirrors the scrypt format in src/lib/auth/password.ts.
// Usage: node scripts/seed-user.mjs <email> <password> "<Tenant Name>"

import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const COST = 16384;

async function hashPassword(plain) {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, 64, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const [email, password, tenantName] = process.argv.slice(2);
if (!email || !password || !tenantName) {
  console.error('Usage: node scripts/seed-user.mjs <email> <password> "<Tenant Name>"');
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Missing SUPABASE_DB_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const tenant = await client.query("select id from tenants where name = $1 limit 1", [tenantName]);
  if (tenant.rows.length === 0) throw new Error(`No tenant named "${tenantName}"`);
  const tenantId = tenant.rows[0].id;

  const hash = await hashPassword(password);
  const user = await client.query(
    `insert into users (email, password_hash, name) values ($1, $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id`,
    [email.toLowerCase(), hash, "Demo Owner"],
  );
  const userId = user.rows[0].id;

  await client.query(
    `insert into tenant_members (tenant_id, user_id, role) values ($1, $2, 'owner')
     on conflict (tenant_id, user_id) do nothing`,
    [tenantId, userId],
  );

  console.log(`User ${email} linked to tenant "${tenantName}" (${tenantId}).`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
