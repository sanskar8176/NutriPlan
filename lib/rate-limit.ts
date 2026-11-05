// Minimal fixed-window rate limiter.
//
// State lives in process memory, which is the right trade-off for a small
// Vercel deployment: it protects a single warm function instance from a burst
// of expensive AI / DB requests and from credential stuffing, with zero extra
// infrastructure. It is NOT shared across instances or regions. If the app
// grows, swap `memoryStore` for a Redis / Upstash / Vercel KV backed store with
// the same interface and nothing else has to change.

export interface RateLimitRule {
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (only meaningful when `ok` is false). */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  hit(key: string, rule: RateLimitRule, now: number): RateLimitResult;
}

export function createMemoryStore(): RateLimitStore {
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  const sweep = (now: number) => {
    // Avoid unbounded growth from unique IPs: drop expired buckets every minute.
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };

  return {
    hit(key, rule, now) {
      sweep(now);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + rule.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const ok = bucket.count <= rule.limit;
      return {
        ok,
        remaining: Math.max(0, rule.limit - bucket.count),
        retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    },
  };
}

// Survive Next.js dev hot-reloads so limits are not reset on every edit.
const g = globalThis as unknown as { __nutriplanRateLimitStore?: RateLimitStore };
const store: RateLimitStore = g.__nutriplanRateLimitStore ?? (g.__nutriplanRateLimitStore = createMemoryStore());

export function rateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  return store.hit(key, rule, now);
}

/** Best-effort client IP. Vercel sets x-forwarded-for / x-real-ip; locally everything is "local". */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export const RATE_LIMITS = {
  /** Account creation: brute-force / spam protection. */
  register:       { limit: 5,  windowMs: 15 * 60_000 },
  /** Credentials sign-in attempts per IP. */
  login:          { limit: 10, windowMs: 15 * 60_000 },
  /** Fresh AI meal-plan generations per IP (each one costs Gemini/USDA/Unsplash calls + DB writes). */
  mealPlanGenerate: { limit: 12, windowMs: 10 * 60_000 },
  /** Loading an already saved plan is cheap. */
  mealPlanSaved:  { limit: 120, windowMs: 60_000 },
  /** Plan saves per user. */
  planSave:       { limit: 30, windowMs: 15 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;
