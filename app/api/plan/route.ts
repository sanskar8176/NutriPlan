import { NextRequest, NextResponse } from "next/server";
import { planInputSchema } from "@/lib/validations";
import { computeNutritionPlan } from "@/lib/calculations";
import { getMealPlan } from "@/lib/food-data";
import { lbsToKg, ftInToCm } from "@/lib/calculations";
import type { DietTag } from "@/lib/food-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = planInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const heightCm = d.unit === "metric"
      ? (d.heightCm ?? 175)
      : ftInToCm(d.heightFt ?? 5, d.heightIn ?? 7);
    const weightKg = d.unit === "metric"
      ? (d.weightKg ?? 70)
      : lbsToKg(d.weightLbs ?? 154);

    const nutrition = computeNutritionPlan({
      age: d.age,
      gender: d.gender,
      heightCm,
      weightKg,
      activityLevel: d.activityLevel,
      goal: d.goal,
      targetRateKg: d.targetRateKg,
    });

    const meals = getMealPlan(d.dietType as DietTag, nutrition.calories, d.allergies);

    return NextResponse.json({ nutrition, meals });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
