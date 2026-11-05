import { NextRequest, NextResponse } from "next/server";
import { planInputSchema } from "@/lib/validations";
import { computeNutritionPlan, calculateBMI, lbsToKg, ftInToCm } from "@/lib/calculations";
import { getMealPlan } from "@/lib/food-data";
import { readJsonBody, jsonError, internalError } from "@/lib/http";

/**
 * POST /api/plan — stateless calculator.
 * Accepts the raw multi-step form payload (metric or imperial), returns the
 * macro targets plus a meal plan from the bundled catalogue. No AI, no DB,
 * no auth; useful for integrations and as a quick health check of the math.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const parsed = planInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError("Invalid input", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  try {
    const d = parsed.data;
    const heightCm = d.unit === "metric" ? d.heightCm! : ftInToCm(d.heightFt!, d.heightIn!);
    const weightKg = d.unit === "metric" ? d.weightKg! : lbsToKg(d.weightLbs!);

    const nutrition = computeNutritionPlan({
      age: d.age, gender: d.gender, heightCm, weightKg,
      activityLevel: d.activityLevel, goal: d.goal, targetRateKg: d.targetRateKg,
    });
    const meals = getMealPlan(d.dietType, nutrition.calories, d.allergies);

    return NextResponse.json({ nutrition, bmi: calculateBMI(weightKg, heightCm), meals });
  } catch (err) {
    return internalError("plan", err);
  }
}
