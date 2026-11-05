import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { buildPoolConfig } from "@/lib/db-config";

// One Prisma client + one pg pool per process, created on first use.
// - The globalThis cache keeps Next.js dev hot-reloads from leaking connections.
// - Lazy creation means importing this module never throws (e.g. during
//   `next build` on a machine without DATABASE_URL); callers that query the DB
//   get the error inside their own try/catch instead.
const g = globalThis as unknown as { prisma?: PrismaClient; pgPool?: Pool };

function createPrismaClient(): PrismaClient {
  if (!g.pgPool) g.pgPool = new Pool(buildPoolConfig());
  const adapter = new PrismaPg(g.pgPool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!g.prisma) {
    const client = createPrismaClient();
    // In production each serverless instance is its own process; caching on
    // globalThis there is harmless and avoids re-creating the client per request.
    g.prisma = client;
  }
  return g.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { buildPoolConfig };
