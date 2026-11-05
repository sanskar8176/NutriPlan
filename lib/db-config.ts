import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA, isSupabaseHost } from "@/lib/supabase-ca";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Builds the pg pool config from DATABASE_URL.
 *
 * - `sslmode` is read from the URL (require / verify-full / disable) and then
 *   removed, because pg's own `sslmode=require` would otherwise silently turn
 *   certificate verification off.
 * - TLS certificates are verified by default. Supabase hosts automatically get
 *   Supabase's bundled root CA. For another provider whose chain is not in the
 *   Node trust store, pass the CA with DATABASE_SSL_CA (PEM text) or, as a last
 *   resort, set DATABASE_SSL_REJECT_UNAUTHORIZED=false.
 * - Local hosts (Docker / localhost) connect without TLS unless `sslmode` asks for it.
 */
export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");

  const isLocal = LOCAL_HOSTS.has(url.hostname);
  const wantSsl = sslmode ? sslmode !== "disable" : !isLocal;
  const rejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const ca = env.DATABASE_SSL_CA?.trim() || (isSupabaseHost(url.hostname) ? SUPABASE_ROOT_CA : undefined);

  return {
    connectionString: url.toString(),
    ssl: wantSsl ? { rejectUnauthorized, ...(ca ? { ca } : {}) } : undefined,
    // Supabase's transaction pooler already multiplexes; keep the per-instance pool small.
    max: env.NODE_ENV === "production" ? 5 : 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  };
}
