import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { savePlanBodySchema } from "@/lib/api-schemas";
import { createPlanForUser, listPlansForUser, UnknownFoodError } from "@/lib/plans";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError, rateLimitedResponse, readJsonBody, internalError } from "@/lib/http";

/** POST /api/plans — save the current plan (auth required). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return jsonError("Unauthorized", 401);

  const limited = rateLimit(`plan-save:${session.user.id}`, RATE_LIMITS.planSave);
  if (!limited.ok) return rateLimitedResponse(limited);

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = savePlanBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError("Invalid plan data", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  try {
    const plan = await createPlanForUser(session.user.id, parsed.data);
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof UnknownFoodError) return jsonError("One or more meals no longer exist. Please regenerate the plan.", 400);
    return internalError("plans:create", err);
  }
}

/** GET /api/plans — list the caller's saved plans. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return jsonError("Unauthorized", 401);

  try {
    const plans = await listPlansForUser(session.user.id);
    return NextResponse.json(plans, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return internalError("plans:list", err);
  }
}
