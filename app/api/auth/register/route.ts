import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/api-schemas";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError, rateLimitedResponse, readJsonBody, internalError } from "@/lib/http";

export async function POST(req: NextRequest) {
  const limited = rateLimit(`register:${getClientIp(req)}`, RATE_LIMITS.register);
  if (!limited.ok) return rateLimitedResponse(limited);

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = registerSchema.safeParse(body.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(first?.message ?? "Invalid input", 400);
  }

  const { name, email, password } = parsed.data;
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return jsonError("Email already registered", 409);

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name, email, password: hashed } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Unique violation from a concurrent signup with the same e-mail.
    if ((err as { code?: string }).code === "P2002") return jsonError("Email already registered", 409);
    return internalError("register", err);
  }
}
