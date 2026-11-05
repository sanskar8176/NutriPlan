/**
 * Seeds the Food table from USDA FoodData Central.
 *
 *   npm run db:seed              # additive: only inserts foods not already present
 *   npm run db:seed -- --limit 200
 *
 * Requires DATABASE_URL (or DIRECT_URL) and optionally USDA_API_KEY in .env.local.
 * With DEMO_KEY the USDA API allows ~30 requests/hour, so expect a partial seed.
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { fetchAllFoods } from "../lib/usda-sync";
import { buildPoolConfig } from "../lib/db-config";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  const apiKey = process.env.USDA_API_KEY?.trim() || "DEMO_KEY";

  const env = { ...process.env, DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL };
  const pool = new Pool(buildPoolConfig(env));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const existing = await prisma.food.findMany({ select: { name: true, fdcId: true } });
    const existingNames  = new Set(existing.map((f) => f.name.toLowerCase().trim()));
    const existingFdcIds = new Set(existing.map((f) => f.fdcId));
    console.log(`Food table currently has ${existing.length} rows. Fetching from USDA (key=${apiKey === "DEMO_KEY" ? "DEMO_KEY" : "custom"})…`);

    const foods = (await fetchAllFoods(apiKey, existingNames, existingFdcIds)).slice(0, limit);
    console.log(`Fetched ${foods.length} new foods. Inserting…`);

    let inserted = 0;
    for (const f of foods) {
      try {
        await prisma.food.create({ data: f });
        inserted += 1;
      } catch (err) {
        // Unique collision on name/fdcId from a previous partial run — skip.
        if ((err as { code?: string }).code !== "P2002") throw err;
      }
    }
    console.log(`Done. Inserted ${inserted} foods.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
