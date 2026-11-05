import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// The Prisma CLI does not load Next.js env files automatically.
// Values already present in the environment win (so CI / Vercel settings are not overridden).
config({ path: path.join(process.cwd(), ".env.local"), quiet: true });
config({ path: path.join(process.cwd(), ".env"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Migrations need a direct (session-mode) connection. Supabase's transaction
    // pooler on port 6543 does not support the statements Prisma Migrate runs.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
