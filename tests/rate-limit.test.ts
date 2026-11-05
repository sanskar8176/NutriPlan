import { describe, it, expect } from "vitest";
import { createMemoryStore, getClientIp } from "@/lib/rate-limit";

describe("memory rate-limit store", () => {
  it("allows up to the limit then blocks within the window", () => {
    const store = createMemoryStore();
    const rule = { limit: 3, windowMs: 1000 };
    const t = 1_000_000;
    expect(store.hit("k", rule, t).ok).toBe(true);
    expect(store.hit("k", rule, t + 1).ok).toBe(true);
    expect(store.hit("k", rule, t + 2).ok).toBe(true);
    const blocked = store.hit("k", rule, t + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("resets after the window", () => {
    const store = createMemoryStore();
    const rule = { limit: 1, windowMs: 1000 };
    expect(store.hit("k", rule, 0).ok).toBe(true);
    expect(store.hit("k", rule, 500).ok).toBe(false);
    expect(store.hit("k", rule, 1000).ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const store = createMemoryStore();
    const rule = { limit: 1, windowMs: 1000 };
    expect(store.hit("a", rule, 0).ok).toBe(true);
    expect(store.hit("b", rule, 0).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then 'local'", () => {
    expect(getClientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(getClientIp(new Request("http://x"))).toBe("local");
  });
});
