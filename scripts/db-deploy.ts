/**
 * Applies pending Prisma migrations, self-baselining databases that were
 * originally created with `prisma db push` (no `_prisma_migrations` table but
 * the application tables already exist). Used by `npm run db:deploy` and by
 * `vercel-build`, so a deploy never fails with "P3005: the database schema is
 * not empty" on an existing database.
 *
 * Connection: DIRECT_URL (session mode) if set, else DATABASE_URL — same rule as prisma.config.ts.
 */
import path from "node:path";
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { Pool } from "pg";
import { buildPoolConfig } from "../lib/db-config";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });
config({ path: path.join(process.cwd(), ".env"), quiet: true });

// The first migration in prisma/migrations; everything an existing db-push database already contains.
const BASELINE_MIGRATION = "0001_init";

function run(cmd: string) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL or DATABASE_URL must be set");

  const pool = new Pool({ ...buildPoolConfig({ ...process.env, DATABASE_URL: url }), max: 1 });
  let needsBaseline = false;
  try {
    const { rows } = await pool.query<{ migrations: string | null; food: string | null }>(
      `select to_regclass('public._prisma_migrations')::text as migrations, to_regclass('public."Food"')::text as food`,
    );
    needsBaseline = !rows[0].migrations && !!rows[0].food;
    console.log(`[db-deploy] migrations table: ${rows[0].migrations ?? "missing"} · app tables: ${rows[0].food ? "present" : "missing"}`);
  } finally {
    await pool.end();
  }

  if (needsBaseline) {
    console.log(`[db-deploy] Existing schema without migration history — marking ${BASELINE_MIGRATION} as applied.`);
    run(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`);
  }
  run("npx prisma migrate deploy");
}

main().catch((err) => {
  console.error("[db-deploy] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
