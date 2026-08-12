import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAIMealPlan, DEFAULT_SYSTEM_PROMPT } from "@/lib/ai-meal-plan";
import type { ModelConfig } from "@/lib/ai-meal-plan";
import { getMealPlanFromDB } from "@/lib/meal-plan-db";
import type { DietTag, MealTime, FoodItem } from "@/lib/food-data";

const DEV = process.env.NODE_ENV === "development";
function dbLog(op: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[35m[NutriPlan:DB:${op}]\x1b[0m`, ...args);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbFoodToItem(f: any, mealTime: MealTime, aiGenerated: boolean): FoodItem {
  return {
    id:          f.id,
    name:        f.name,
    description: f.description ?? "",
    calories:    Math.round(f.calories),
    proteinG:    Math.round(f.proteinG),
    carbsG:      Math.round(f.carbsG),
    fatG:        Math.round(f.fatG),
    mealTime:    [mealTime],
    dietTags:    f.dietTags,
    image:       f.image,
    servingSize: f.servingSize,
    aiGenerated,
  };
}

// Random synthetic fdcId in negative int range — safe across HMR restarts and concurrent requests
// Range: -1 to -2,000,000,000 (well within PostgreSQL int bounds)
function syntheticFdcId() {
  return -(Math.floor(Math.random() * 2_000_000_000) + 1);
}

// ── planId path: load saved meals from DB, zero AI ───────────────────────────
async function loadSavedPlan(planId: string): Promise<NextResponse> {
  dbLog("PlanMeal:FindMany", `planId=${planId}`);
  const planMeals = await prisma.planMeal.findMany({
    where:   { planId },
    include: { food: true },
    orderBy: { position: "asc" },
  });
  dbLog("PlanMeal:FindMany:Result", `${planMeals.length} rows for planId=${planId}`);

  const result: Record<MealTime, FoodItem[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const pm of planMeals) {
    const mt = pm.mealTime as MealTime;
    if (result[mt]) result[mt].push(dbFoodToItem(pm.food, mt, pm.aiGenerated));
  }
  return NextResponse.json(result);
}

// Upsert one AI food item — serialised by caller, always returns the DB record
async function upsertFood(item: Awaited<ReturnType<typeof generateAIMealPlan>>[number]) {
  const updatePayload = {
    description: item.description,
    calories:    item.calories,
    proteinG:    item.proteinG,
    carbsG:      item.carbsG,
    fatG:        item.fatG,
    fiberG:      item.fiberG,
    image:       item.image,
    mealTimes:   [item.mealTime],
    dietTags:    item.dietTags,
    category:    item.category,
    servingSize: item.servingSize,
    servingG:    item.servingG,
  };

  dbLog("Food:Upsert", `name="${item.name}"`);

  // 1st attempt — standard upsert
  try {
    const food = await prisma.food.upsert({
      where:  { name: item.name },
      update: updatePayload,
      create: { fdcId: syntheticFdcId(), name: item.name, ...updatePayload },
    });
    dbLog("Food:Upsert:OK", `id=${food.id}`);
    return food;
  } catch (e1) {
    dbLog("Food:Upsert:Err", `name="${item.name}"  code=${(e1 as {code?:string}).code ?? "?"} — trying findUnique`);
  }

  // 2nd attempt — row may now exist (written by the upsert above or a prior request)
  const existing = await prisma.food.findUnique({ where: { name: item.name } });
  if (existing) {
    dbLog("Food:Upsert:Recovered", `id=${existing.id}  via findUnique`);
    return existing;
  }

  // 3rd attempt — row genuinely doesn't exist, retry create with a fresh random fdcId
  // Retry up to 3 times in case of fdcId collision (astronomically unlikely but safe)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      dbLog("Food:Upsert:RetryCreate", `name="${item.name}"  attempt=${attempt}`);
      const food = await prisma.food.create({
        data: { fdcId: syntheticFdcId(), name: item.name, ...updatePayload },
      });
      dbLog("Food:Upsert:RetryCreate:OK", `id=${food.id}`);
      return food;
    } catch (e2) {
      const code = (e2 as {code?:string}).code;
      if (code === "P2002" && attempt < 3) continue; // fdcId collision — retry with new random
      // name collision on retry means another request just inserted it — fetch it
      const race = await prisma.food.findUnique({ where: { name: item.name } });
      if (race) {
        dbLog("Food:Upsert:RaceRecovered", `id=${race.id}`);
        return race;
      }
      throw e2;
    }
  }
  throw new Error(`upsertFood: exhausted retries for "${item.name}"`);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // ── Saved plan: read from DB, no AI ──────────────────────────────────────
  const planId = sp.get("planId");
  if (planId) return loadSavedPlan(planId);

  // ── Fresh generation ──────────────────────────────────────────────────────
  const dietType  = (sp.get("dietType")      ?? "non_veg") as DietTag;
  const calories  = Number(sp.get("calories")  ?? 2000);
  const seed      = Number(sp.get("seed")      ?? 0);
  const allergies = sp.get("allergies")?.split(",").filter(Boolean) ?? [];
  const proteinG  = Number(sp.get("proteinG")  ?? 150);
  const carbsG    = Number(sp.get("carbsG")    ?? 200);
  const fatG      = Number(sp.get("fatG")      ?? 65);
  const age       = Number(sp.get("age")       ?? 25);
  const gender    = sp.get("gender")           ?? "male";
  const weightKg  = Number(sp.get("weightKg")  ?? 70);
  const heightCm  = Number(sp.get("heightCm")  ?? 175);
  const goal      = sp.get("goal")             ?? "maintain";
  const activity  = sp.get("activityLevel")    ?? "moderate";

  const geminiKey      = process.env.GEMINI_API_KEY;
  const localBaseUrl   = process.env.LOCAL_MODEL_BASE_URL;
  const localModelName = process.env.LOCAL_MODEL_NAME;
  const usdaKey        = process.env.USDA_API_KEY ?? "DEMO_KEY";

  const useLocal  = !!(localBaseUrl && localModelName);
  const useGemini = !!(geminiKey && geminiKey !== "your_gemini_api_key_here");

  if (!useLocal && !useGemini) {
    dbLog("MealPlan:DBFallback", "No AI configured — using getMealPlanFromDB");
    const meals = await getMealPlanFromDB(dietType, calories, allergies, seed);
    return NextResponse.json(meals);
  }

  const modelConfig: ModelConfig = useLocal
    ? { provider: "local",  localBaseUrl, localModel: localModelName, systemPrompt: DEFAULT_SYSTEM_PROMPT }
    : { provider: "gemini", geminiApiKey: geminiKey!, systemPrompt: DEFAULT_SYSTEM_PROMPT };

  try {
    const aiItems = await generateAIMealPlan(
      { age, gender, weightKg, heightCm, goal, activityLevel: activity,
        dietType, allergies, targetCalories: calories, proteinG, carbsG, fatG,
        seed, usdaApiKey: usdaKey },
      modelConfig,
    );

    dbLog("Food:UpsertBatch:Start", `${aiItems.length} items to upsert`);

    // Serialised — avoids race conditions where concurrent upserts all fail on the
    // same name unique constraint, then all call findUnique before any commit
    const savedFoods: Array<{ food: Awaited<ReturnType<typeof upsertFood>>; item: typeof normalisedItems[number] }> = [];
    const VALID_MEAL_TIMES = new Set<MealTime>(["breakfast", "lunch", "dinner", "snack"]);
    const normaliseMealTime = (raw: string): MealTime => {
      const v = raw.toLowerCase().trim().replace(/s$/, "") as MealTime;
      return VALID_MEAL_TIMES.has(v) ? v : "snack";
    };
    const normalisedItems = aiItems.map((item) => ({ ...item, mealTime: normaliseMealTime(item.mealTime) }));

    for (const item of normalisedItems) {
      const food = await upsertFood(item);
      savedFoods.push({ food, item });
    }

    dbLog("Food:UpsertBatch:Done", `${savedFoods.length} foods persisted`);

    // Shape into Record<MealTime, FoodItem[]>
    const plan: Record<MealTime, FoodItem[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const { food, item } of savedFoods) {
      const mt = item.mealTime;
      dbLog("MealPlan:SlotAssign", `"${item.name}"  mealTime=${mt}`);
      plan[mt].push({
        id:          food.id,
        name:        item.name,
        description: item.description,
        calories:    item.calories,
        proteinG:    item.proteinG,
        carbsG:      item.carbsG,
        fatG:        item.fatG,
        mealTime:    [mt],
        dietTags:    item.dietTags as DietTag[],
        image:       item.image,
        servingSize: item.servingSize,
        aiGenerated: true,
      });
    }

    dbLog("MealPlan:Response", `breakfast=${plan.breakfast.length} lunch=${plan.lunch.length} dinner=${plan.dinner.length} snack=${plan.snack.length}`);
    return NextResponse.json(plan);

  } catch (err) {
    console.error("AI meal plan error:", err);
    dbLog("MealPlan:AIFailed", `Falling back to DB — ${(err as Error).message}`);
    const meals = await getMealPlanFromDB(dietType, calories, allergies, seed);
    return NextResponse.json(meals);
  }
}
