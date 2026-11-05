// Small helpers shared by the route handlers so every endpoint answers the
// same way: JSON errors with a stable shape, safe body parsing, rate-limit
// responses with Retry-After, and no stack traces leaking to clients.
import { NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/rate-limit";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function rateLimitedResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

/** Parses a JSON body; returns a 400 response instead of throwing on malformed input. */
export async function readJsonBody(req: Request, maxBytes = 64 * 1024): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, response: jsonError("Request body too large", 413) };
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { ok: false, response: jsonError("Request body too large", 413) };
    return { ok: true, data: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: jsonError("Malformed JSON body", 400) };
  }
}

/** Logs the real error server-side and returns a generic 500 to the client. */
export function internalError(context: string, err: unknown) {
  console.error(`[NutriPlan] ${context}:`, err instanceof Error ? err.message : err);
  return jsonError("Internal server error", 500);
}
