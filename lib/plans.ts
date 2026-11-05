import "server-only";
// Data-access layer for saved plans. Every function takes the authenticated
// userId and scopes the query to it, so route handlers cannot forget the
// ownership check (the IDOR class of bug).
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeNutritionPlan, calculateBMI } from "@/lib/calculations";
import { normalizeAllergies } from "@/lib/allergens";
import { FOOD_BY_ID } from "@/lib/food-data";
import type { MealTime } from "@/lib/food-data";
import { dbFoodToItem } from "@/lib/meal-plan-db";
import { syntheticFdcId } from "@/lib/meal-plan-service";
import type { SavePlanBody } from "@/lib/api-schemas";
import type { MealsByTime, PlanDTO } from "@/lib/types";

export function toPlanDTO(p: Plan): PlanDTO {
  return {
    id: p.id, name: p.name, createdAt: p.createdAt.toISOString(),
    age: p.age, gender: p.gender, heightCm: p.heightCm, weightKg: p.weightKg,
    activityLevel: p.activityLevel, goal: p.goal, targetRateKg: p.targetRateKg,
    dietType: p.dietType, allergies: p.allergies,
    calories: p.calories, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG,
    bmr: p.bmr, tdee: p.tdee, bmi: p.bmi,
  };
}

export async function listPlansForUser(userId: string): Promise<PlanDTO[]> {
  const plans = await prisma.plan.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return plans.map(toPlanDTO);
}

/** Meals of a saved plan, or null when the plan does not exist or belongs to someone else. */
export async function getSavedPlanMeals(planId: string, userId: string): Promise<MealsByTime | null> {
  const plan = await prisma.plan.findFirst({ where: { id: planId, userId }, select: { id: true } });
  if (!plan) return null;

  const planMeals = await prisma.planMeal.findMany({
    where: { planId },
    include: { food: true },
    orderBy: { position: "asc" },
  });

  const result: MealsByTime = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const pm of planMeals) {
    const mt = pm.mealTime as MealTime;
    if (result[mt]) result[mt].push(dbFoodToItem(pm.food, mt, pm.aiGenerated));
  }
  return result;
}

export class UnknownFoodError extends Error {
  constructor(public readonly foodIds: string[]) {
    super(`Unknown food item(s): ${foodIds.join(", ")}`);
  }
}

/**
 * Resolves client-supplied food ids to real Food rows. Ids from the bundled
 * static catalogue (used when AI and DB were unavailable) are materialised
 * into the Food table on first save so the plan can be reloaded later.
 */
async function resolveFoodIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const found = await prisma.food.findMany({ where: { id: { in: unique } }, select: { id: true } });
  const resolved = new Map<string, string>(found.map((f) => [f.id, f.id]));

  const unknown: string[] = [];
  for (const id of unique) {
    if (resolved.has(id)) continue;
    const staticItem = FOOD_BY_ID.get(id);
    if (!staticItem) { unknown.push(id); continue; }

    const existing = await prisma.food.findUnique({ where: { name: staticItem.name }, select: { id: true } });
    const row = existing ?? await prisma.food.create({
      data: {
        fdcId:       syntheticFdcId(),
        name:        staticItem.name,
        description: staticItem.description ?? "",
        calories:    staticItem.calories,
        proteinG:    staticItem.proteinG,
        carbsG:      staticItem.carbsG,
        fatG:        staticItem.fatG,
        image:       staticItem.image,
        mealTimes:   staticItem.mealTime,
        dietTags:    staticItem.dietTags,
        category:    "static",
        servingSize: staticItem.servingSize,
      },
      select: { id: true },
    });
    resolved.set(id, row.id);
  }
  if (unknown.length > 0) throw new UnknownFoodError(unknown);
  return resolved;
}

/** Creates a plan. Macros, BMR, TDEE and BMI are computed here from the profile, never taken from the client. */
export async function createPlanForUser(userId: string, input: SavePlanBody): Promise<PlanDTO> {
  const nutrition = computeNutritionPlan({
    age: input.age, gender: input.gender, heightCm: input.heightCm, weightKg: input.weightKg,
    activityLevel: input.activityLevel, goal: input.goal, targetRateKg: input.targetRateKg,
  });
  const bmi = calculateBMI(input.weightKg, input.heightCm);
  const foodIdMap = await resolveFoodIds(input.meals.map((m) => m.foodId));

  const plan = await prisma.plan.create({
    data: {
      userId,
      name:          input.name,
      age:           input.age,
      gender:        input.gender,
      heightCm:      input.heightCm,
      weightKg:      input.weightKg,
      activityLevel: input.activityLevel,
      goal:          input.goal,
      targetRateKg:  input.goal === "maintain" ? null : (input.targetRateKg ?? 0.5),
      dietType:      input.dietType,
      allergies:     normalizeAllergies(input.allergies),
      calories:      nutrition.calories,
      proteinG:      nutrition.proteinG,
      carbsG:        nutrition.carbsG,
      fatG:          nutrition.fatG,
      bmr:           nutrition.bmr,
      tdee:          nutrition.tdee,
      bmi,
      meals: input.meals.length > 0 ? {
        create: input.meals.map((m) => ({
          foodId:      foodIdMap.get(m.foodId)!,
          mealTime:    m.mealTime,
          position:    m.position,
          aiGenerated: m.aiGenerated,
        })),
      } : undefined,
    },
  });
  return toPlanDTO(plan);
}

/** Deletes a plan the user owns. Returns false when nothing matched (not found or not theirs). */
export async function deletePlanForUser(planId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.plan.deleteMany({ where: { id: planId, userId } });
  return count > 0;
}
