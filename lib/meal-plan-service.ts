import "server-only";
import type { Food } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAIMealPlan, DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-meal-plan";
import type { AIMealItem, ModelConfig } from "@/lib/ai-meal-plan";
import { getMealPlanFromDB, dbFoodToItem } from "@/lib/meal-plan-db";
import { getMealPlan as getStaticMealPlan } from "@/lib/food-data";
import type { MealTime } from "@/lib/food-data";
import type { MealPlanQuery } from "@/lib/api-schemas";
import { computeNutritionPlan } from "@/lib/calculations";
import { emptyMeals, fillMissingSlots, isCompletePlan } from "@/lib/meal-plan-utils";
import type { MealsByTime, MealPlanSource } from "@/lib/types";

const DEV = process.env.NODE_ENV === "development";
function dbLog(op: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[35m[NutriPlan:DB:${op}]\x1b[0m`, ...args);
}

// Synthetic negative fdcId for AI-generated foods (real USDA ids are positive).
export function syntheticFdcId() {
  return -(Math.floor(Math.random() * 2_000_000_000) + 1);
}

/**
 * Which AI providers are configured, in the order they will be tried.
 *
 *   Local development : local model (Ollama) → Gemini   (→ database → static)
 *   Vercel / hosted   : Gemini                           (→ database → static)
 *
 * A local model only exists on a developer machine, so on Vercel it is skipped
 * even if the variables are set, which keeps production from wasting a timeout
 * on a connection that can never succeed.
 */
export function configuredProviders(env: NodeJS.ProcessEnv = process.env): ModelConfig[] {
  const providers: ModelConfig[] = [];
  const localBaseUrl = env.LOCAL_MODEL_BASE_URL?.trim();
  const localModel   = env.LOCAL_MODEL_NAME?.trim();
  const geminiKey    = env.GEMINI_API_KEY?.trim();
  const hosted       = env.VERCEL === "1" || env.NUTRIPLAN_DISABLE_LOCAL_MODEL === "true";

  if (localBaseUrl && localModel && !hosted) {
    providers.push({ provider: "local", localBaseUrl, localModel, systemPrompt: DEFAULT_SYSTEM_PROMPT });
  }
  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    providers.push({
      provider: "gemini",
      geminiApiKey: geminiKey,
      geminiModel: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
  }
  return providers;
}

/**
 * Upserts one AI food by its unique name. Serialised by the caller.
 * Existing rows keep their id (so saved plans stay valid) and gain any new
 * meal time / diet tag instead of being overwritten.
 */
export async function upsertAiFood(item: AIMealItem): Promise<Food> {
  const data = {
    description: item.description,
    calories:    item.calories,
    proteinG:    item.proteinG,
    carbsG:      item.carbsG,
    fatG:        item.fatG,
    fiberG:      item.fiberG,
    image:       item.image,
    category:    item.category,
    servingSize: item.servingSize,
    servingG:    item.servingG,
  };

  const existing = await prisma.food.findUnique({ where: { name: item.name } });
  if (existing) {
    return prisma.food.update({
      where: { id: existing.id },
      data: {
        ...data,
        mealTimes: [...new Set([...existing.mealTimes, item.mealTime])],
        dietTags:  [...new Set([...existing.dietTags, ...item.dietTags])],
      },
    });
  }

  // Create; on a unique-constraint race (same name inserted concurrently, or an
  // astronomically unlikely fdcId collision) retry a couple of times then read back.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.food.create({
        data: { fdcId: syntheticFdcId(), name: item.name, mealTimes: [item.mealTime], dietTags: item.dietTags, ...data },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002") throw err;
      const raced = await prisma.food.findUnique({ where: { name: item.name } });
      if (raced) return raced;
      if (attempt === 3) throw err;
    }
  }
  throw new Error(`upsertAiFood: exhausted retries for "${item.name}"`);
}

async function persistAiItems(items: AIMealItem[]): Promise<MealsByTime> {
  const plan = emptyMeals();
  for (const item of items) {
    const food = await upsertAiFood(item);
    plan[item.mealTime].push({
      ...dbFoodToItem(food, item.mealTime, true),
      // Prefer the freshly generated description/macros for this response.
      description: item.description,
      calories:    Math.round(item.calories),
      proteinG:    Math.round(item.proteinG),
      carbsG:      Math.round(item.carbsG),
      fatG:        Math.round(item.fatG),
    });
  }
  return plan;
}

export interface BuiltMealPlan {
  meals: MealsByTime;
  source: MealPlanSource;
}

/**
 * Builds a meal plan for a validated profile with graceful degradation:
 *   local model → Gemini → foods already in the database → bundled static catalogue.
 * Each stage is independent; a dead Ollama, an exhausted Gemini quota or an
 * unreachable database never produces an empty page.
 */
export async function buildMealPlan(query: MealPlanQuery, env: NodeJS.ProcessEnv = process.env): Promise<BuiltMealPlan> {
  const nutrition = computeNutritionPlan({
    age: query.age, gender: query.gender, heightCm: query.heightCm, weightKg: query.weightKg,
    activityLevel: query.activityLevel, goal: query.goal, targetRateKg: query.targetRateKg,
  });

  const profile = {
    age: query.age, gender: query.gender, weightKg: query.weightKg, heightCm: query.heightCm,
    goal: query.goal, activityLevel: query.activityLevel, dietType: query.dietType,
    allergies: query.allergies, targetCalories: nutrition.calories,
    proteinG: nutrition.proteinG, carbsG: nutrition.carbsG, fatG: nutrition.fatG,
    seed: query.seed, usdaApiKey: env.USDA_API_KEY?.trim() || "DEMO_KEY",
  };

  // Non-AI plan (DB if populated, else static). Used as the fallback and to
  // top up slots the AI guard-rails emptied.
  const nonAiPlan = async (): Promise<{ meals: MealsByTime; source: MealPlanSource }> => {
    try {
      const meals = await getMealPlanFromDB(query.dietType, nutrition.calories, query.allergies, query.seed);
      if (meals) return { meals, source: "database" };
      dbLog("MealPlan:DBFallback", "Food table too small — using static catalogue");
    } catch (err) {
      console.warn(`[NutriPlan] database fallback failed, using static catalogue: ${(err as Error).message}`);
    }
    return { meals: getStaticMealPlan(query.dietType, nutrition.calories, query.allergies, query.seed), source: "static" };
  };

  for (const modelConfig of configuredProviders(env)) {
    try {
      const items = await generateAIMealPlan(profile, modelConfig);
      let meals = await persistAiItems(items);
      dbLog("MealPlan:AI", `${modelConfig.provider} produced ${items.length} items`);
      if (!isCompletePlan(meals)) {
        const { meals: filler } = await nonAiPlan();
        const result = fillMissingSlots(meals, filler);
        meals = result.meals;
        dbLog("MealPlan:Backfill", `${result.filled} slot(s) filled from fallback`);
      }
      return { meals, source: modelConfig.provider };
    } catch (err) {
      console.warn(`[NutriPlan] ${modelConfig.provider} provider failed, trying next: ${(err as Error).message}`);
    }
  }

  return nonAiPlan();
}

export type { MealTime };
