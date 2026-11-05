import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { mealPlanQuerySchema, searchParamsToObject } from "@/lib/api-schemas";
import { buildMealPlan } from "@/lib/meal-plan-service";
import { getSavedPlanMeals } from "@/lib/plans";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { jsonError, rateLimitedResponse, internalError } from "@/lib/http";
import type { MealPlanResponse } from "@/lib/types";

/**
 * GET /api/meal-plan?planId=…            → meals of one of the caller's saved plans (auth required)
 * GET /api/meal-plan?age=…&gender=…&…   → freshly generated plan (local model → Gemini → DB → static)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ip = getClientIp(req);

  // ── Saved plan: owner only ────────────────────────────────────────────────
  const planId = sp.get("planId");
  if (planId) {
    const limited = rateLimit(`meal-plan:saved:${ip}`, RATE_LIMITS.mealPlanSaved);
    if (!limited.ok) return rateLimitedResponse(limited);

    const session = await auth();
    if (!session?.user?.id) return jsonError("Unauthorized", 401);
    if (planId.length > 64) return jsonError("Invalid planId", 400);

    try {
      const meals = await getSavedPlanMeals(planId, session.user.id);
      if (!meals) return jsonError("Plan not found", 404);
      const body: MealPlanResponse = { meals, source: "database", saved: true };
      return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
      return internalError("meal-plan:saved", err);
    }
  }

  // ── Fresh generation: validated profile + rate limit ──────────────────────
  const parsed = mealPlanQuerySchema.safeParse(searchParamsToObject(sp));
  if (!parsed.success) {
    return jsonError("Invalid profile parameters", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const limited = rateLimit(`meal-plan:generate:${ip}`, RATE_LIMITS.mealPlanGenerate);
  if (!limited.ok) return rateLimitedResponse(limited);

  try {
    const { meals, source } = await buildMealPlan(parsed.data);
    const body: MealPlanResponse = { meals, source, saved: false };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return internalError("meal-plan:generate", err);
  }
}
