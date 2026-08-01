import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const g = globalThis as unknown as { prisma?: PrismaClient; pgPool?: Pool };

function createPrismaClient() {
  // Reuse pool across HMR reloads to prevent connection leaks
  if (!g.pgPool) {
    const connectionString = (process.env.DATABASE_URL ?? "").replace(
      /[?&]sslmode=[^&]*/,
      (m) => (m.startsWith("?") ? "" : ""),
    );
    g.pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3, // limit pool size in dev
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  const adapter = new PrismaPg(g.pgPool);
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = g.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
