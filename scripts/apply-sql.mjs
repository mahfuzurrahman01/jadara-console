// Applies every SQL file in supabase/migrations (sorted) against SUPABASE_DB_URL.
// Usage: SUPABASE_DB_URL=postgres://... node scripts/apply-sql.mjs
// Get the connection string from Supabase: Project Settings -> Database -> Connection string (URI).
// Use the pooler/session string and include your DB password.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Missing SUPABASE_DB_URL. Set it to your Supabase Postgres connection string.");
  process.exit(1);
}

// Optional args: specific migration filenames to apply (e.g. `pnpm db:apply 0003_auth.sql`).
// With no args, applies every migration in order (fresh-database bootstrap).
const only = process.argv.slice(2);
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => only.length === 0 || only.includes(f))
  .sort();

if (files.length === 0) {
  console.error("No .sql files found in", migrationsDir);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    process.stdout.write(`Applying ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("\nAll migrations applied.");
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
