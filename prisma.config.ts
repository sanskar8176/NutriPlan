import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Prisma CLI doesn't load Next.js env files automatically
config({ path: path.join(process.cwd(), ".env.local") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
