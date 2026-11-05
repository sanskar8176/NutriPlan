import { describe, it, expect } from "vitest";
import { buildPoolConfig } from "@/lib/db-config";

describe("buildPoolConfig", () => {
  it("throws without DATABASE_URL", () => {
    expect(() => buildPoolConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it("strips sslmode from the URL and verifies certificates by default", () => {
    const cfg = buildPoolConfig({ DATABASE_URL: "postgresql://u:p@db.example.com:6543/app?sslmode=require&pgbouncer=true" } as NodeJS.ProcessEnv);
    expect(cfg.connectionString).toBe("postgresql://u:p@db.example.com:6543/app?pgbouncer=true");
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("disables TLS for localhost unless sslmode says otherwise", () => {
    expect(buildPoolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/app" } as NodeJS.ProcessEnv).ssl).toBeUndefined();
    expect(buildPoolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/app?sslmode=require" } as NodeJS.ProcessEnv).ssl).toEqual({ rejectUnauthorized: true });
  });

  it("honours sslmode=disable on remote hosts", () => {
    expect(buildPoolConfig({ DATABASE_URL: "postgresql://u:p@db.example.com/app?sslmode=disable" } as NodeJS.ProcessEnv).ssl).toBeUndefined();
  });

  it("bundles the Supabase root CA for Supabase pooler hosts", () => {
    const cfg = buildPoolConfig({ DATABASE_URL: "postgresql://u:p@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true" } as NodeJS.ProcessEnv);
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((cfg.ssl as { ca?: string }).ca).toContain("BEGIN CERTIFICATE");
    expect(cfg.connectionString).toContain("pgbouncer=true");
  });

  it("supports an explicit CA and the verification escape hatch", () => {
    const withCa = buildPoolConfig({ DATABASE_URL: "postgresql://u:p@db.example.com/app", DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----" } as NodeJS.ProcessEnv);
    expect(withCa.ssl).toEqual({ rejectUnauthorized: true, ca: "-----BEGIN CERTIFICATE-----" });
    const relaxed = buildPoolConfig({ DATABASE_URL: "postgresql://u:p@db.example.com/app", DATABASE_SSL_REJECT_UNAUTHORIZED: "false" } as NodeJS.ProcessEnv);
    expect(relaxed.ssl).toEqual({ rejectUnauthorized: false });
  });
});
