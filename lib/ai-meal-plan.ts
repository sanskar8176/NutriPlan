// AI Meal Plan Generator
// Providers : Google Gemini (@google/genai) | any OpenAI-compatible local server (Ollama, LM Studio)
// Cross-check: USDA FoodData Central (calories/macros)
// Images    : Unsplash search with category fallbacks
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { DietTag, MealTime } from "@/lib/food-data";
import { excludeAllergens } from "@/lib/allergens";
import { imageForCategory, isAllowedImageUrl } from "@/lib/images";

const DEV = process.env.NODE_ENV === "development";

function log(section: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[36m[NutriPlan:${section}]\x1b[0m`, ...args);
}

const USDA_API_BASE   = "https://api.nal.usda.gov/fdc/v1";
const NUTRIENT_IDS    = { calories: 1008, protein: 1003, fat: 1004, carbs: 1005, fiber: 1079 };
const GEMINI_LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Every outbound call has a hard timeout so a slow or dead provider fails fast
// and the route can fall back instead of hanging until the function times out.
export const TIMEOUTS = {
  model:   45_000,
  local:   30_000,
  usda:     8_000,
  unsplash: 6_000,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AIMealItem {
  name: string;
  description: string;
  mealTime: MealTime;
  servingSize: string;
  servingG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  image: string;
  dietTags: string[];
  category: string;
  aiGenerated: true;
}

export type ModelProvider = "gemini" | "local";

export interface ModelConfig {
  provider: ModelProvider;
  geminiApiKey?: string;
  geminiModel?: string;
  localBaseUrl?: string;   // e.g. http://localhost:11434/v1  (Ollama OpenAI-compat)
  localModel?: string;     // e.g. llama3.2, mistral, phi3
  systemPrompt?: string;   // editable system prompt override
}

export interface MealPlanProfile {
  age: number; gender: string; weightKg: number; heightCm: number;
  goal: string; activityLevel: string; dietType: DietTag;
  allergies: string[]; targetCalories: number;
  proteinG: number; carbsG: number; fatG: number;
  seed: number; usdaApiKey: string;
}

// ── Model output validation ──────────────────────────────────────────────────
// The model's JSON is untrusted input: validate shape, clamp numbers, cap lengths.
const aiFoodSchema = z.object({
  name:              z.string().trim().min(2).max(80),
  description:       z.string().trim().max(300).catch(""),
  mealTime:          z.string().trim().toLowerCase(),
  servingSize:       z.string().trim().min(1).max(60).catch("1 serving"),
  servingG:          z.coerce.number().min(10).max(1500).catch(200),
  estimatedCalories: z.coerce.number().min(10).max(3000),
  estimatedProteinG: z.coerce.number().min(0).max(300).catch(0),
  estimatedCarbsG:   z.coerce.number().min(0).max(500).catch(0),
  estimatedFatG:     z.coerce.number().min(0).max(300).catch(0),
  category:          z.string().trim().toLowerCase().max(30).catch("default"),
});
type AIFood = z.infer<typeof aiFoodSchema>;

const modelResponseSchema = z.object({ meals: z.array(z.unknown()).max(20) });

function parseModelOutput(rawText: string, section: string): AIFood[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`${section}: model returned non-JSON output`);
  }
  const outer = modelResponseSchema.safeParse(parsed);
  if (!outer.success) throw new Error(`${section}: model output missing "meals" array`);

  const meals: AIFood[] = [];
  for (const m of outer.data.meals) {
    const r = aiFoodSchema.safeParse(m);
    if (r.success) meals.push(r.data);
    else log(`${section}:DroppedItem`, r.error.issues.map((i) => i.message).join("; "));
  }
  if (meals.length === 0) throw new Error(`${section}: no valid meals in model output`);
  return meals;
}

// ── Default system prompt ─────────────────────────────────────────────────────
export const DEFAULT_SYSTEM_PROMPT = `You are a certified nutritionist and culinary expert specializing in Indian and global cuisine.

STRICT RULES:
- Strong preference for Indian foods: dal, roti, chapati, rice dishes, sabzi, curry, idli, dosa, upma, poha, biryani, khichdi, paneer dishes, etc.
- No beef under any circumstances.
- Respect the diet type exactly: vegetarian/vegan/eggetarian plans must never contain meat or fish; vegan plans must never contain dairy or eggs.
- Never include any listed allergen, including as a hidden ingredient (e.g. ghee or paneer for a dairy allergy, roti or semolina for gluten).
- All meal names must be completely unique — zero repetition across breakfast, lunch, dinner, and snacks.
- Each food must be realistic, commonly available, and nutritionally accurate.
- Descriptions must be appetizing, informative, and 1–2 sentences max.
- Nutrition values must be realistic per the specified serving size.
- Vary meals meaningfully when seed changes — different seed = genuinely different meals.`;

// ── Structured output schema (Gemini) ────────────────────────────────────────
const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:               { type: Type.STRING },
          description:        { type: Type.STRING },
          mealTime:           { type: Type.STRING, enum: ["breakfast", "lunch", "dinner", "snack"] },
          servingSize:        { type: Type.STRING },
          servingG:           { type: Type.NUMBER },
          estimatedCalories:  { type: Type.NUMBER },
          estimatedProteinG:  { type: Type.NUMBER },
          estimatedCarbsG:    { type: Type.NUMBER },
          estimatedFatG:      { type: Type.NUMBER },
          category:           { type: Type.STRING },
        },
        required: ["name", "description", "mealTime", "servingSize", "servingG",
                   "estimatedCalories", "estimatedProteinG", "estimatedCarbsG",
                   "estimatedFatG", "category"],
      },
    },
  },
  required: ["meals"],
};

// Same schema as plain JSON Schema for OpenAI-compatible servers.
const LOCAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:              { type: "string" },
          description:       { type: "string" },
          mealTime:          { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          servingSize:       { type: "string" },
          servingG:          { type: "number" },
          estimatedCalories: { type: "number" },
          estimatedProteinG: { type: "number" },
          estimatedCarbsG:   { type: "number" },
          estimatedFatG:     { type: "number" },
          category:          { type: "string" },
        },
        required: ["name", "description", "mealTime", "servingSize", "servingG",
                   "estimatedCalories", "estimatedProteinG", "estimatedCarbsG",
                   "estimatedFatG", "category"],
      },
    },
  },
  required: ["meals"],
};

// ── User prompt builder ───────────────────────────────────────────────────────
export function buildUserPrompt(params: Omit<MealPlanProfile, "usdaApiKey">): string {
  const goalDesc = {
    lose:     "weight loss (calorie deficit)",
    maintain: "weight maintenance",
    gain:     "muscle gain (calorie surplus)",
  }[params.goal] ?? params.goal;

  const dietNote: Record<DietTag, string> = {
    non_veg:    "Include meat, fish, eggs, and dairy. Prefer Indian non-veg dishes.",
    vegetarian: "No meat or fish. Eggs and dairy allowed. Prefer Indian vegetarian dishes.",
    vegan:      "No animal products — no meat, fish, eggs, dairy, ghee, paneer or honey.",
    eggetarian: "No meat or fish. Eggs and dairy allowed. Prefer Indian dishes.",
    keto:       "High fat, very low carb (under 20g net carbs total). No grains or sugar.",
  };

  // Allergies are user input that ends up inside the prompt: strip anything
  // that is not a plain word so they cannot smuggle extra instructions in.
  const cleanAllergies = params.allergies
    .map((a) => a.replace(/[^a-z0-9 \-]/gi, "").trim())
    .filter(Boolean)
    .slice(0, 20);
  const allergyLine = cleanAllergies.length > 0
    ? `Strictly avoid these allergens (and dishes that commonly contain them): ${cleanAllergies.join(", ")}.`
    : "No known allergies.";

  return `USER PROFILE:
- Age: ${params.age} | Gender: ${params.gender}
- Weight: ${params.weightKg}kg | Height: ${params.heightCm}cm
- Goal: ${goalDesc}
- Activity level: ${params.activityLevel}
- Diet type: ${params.dietType} — ${dietNote[params.dietType]}
- ${allergyLine}
- Daily calorie target: ${params.targetCalories} kcal
- Macro targets: Protein ${params.proteinG}g | Carbs ${params.carbsG}g | Fat ${params.fatG}g
- Variety seed: ${params.seed}

Generate exactly 5 meal items:
• 1 breakfast
• 1 lunch
• 1 dinner
• 2 snacks

All 5 names must be unique. Return valid JSON only.`;
}

// ── Gemini ────────────────────────────────────────────────────────────────────
// Runs once per process — warns if the configured model is not in ListModels.
let _modelCheckPromise: Promise<void> | null = null;
function validateGeminiModel(apiKey: string, model: string): Promise<void> {
  if (_modelCheckPromise) return _modelCheckPromise;
  _modelCheckPromise = (async () => {
    try {
      // API key goes in a header, never in the URL (URLs end up in logs and proxies).
      const res = await fetch(`${GEMINI_LIST_URL}?pageSize=200`, {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(TIMEOUTS.usda),
      });
      if (!res.ok) { log("Gemini:ModelCheck", `ListModels returned ${res.status} — skipping check`); return; }
      const data = await res.json() as { models?: Array<{ name: string }> };
      const ids  = (data.models ?? []).map((m) => m.name.replace("models/", ""));
      if (ids.includes(model)) log("Gemini:ModelCheck", `✓ "${model}" available`);
      else console.warn(`[NutriPlan:Gemini] "${model}" is not in ListModels. Available: ${ids.slice(0, 15).join(", ")}…`);
    } catch (err) {
      log("Gemini:ModelCheck", `ListModels fetch failed: ${(err as Error).message}`);
    }
  })();
  return _modelCheckPromise;
}

/** Stable, widely available model used when the configured one is overloaded or unknown. */
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // 429 = quota/rate limit, 503 = "model is currently experiencing high load", 404 = model id not available on this key
  return /"code":\s*(429|503|404)|\b(429|503|404)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high load/i.test(msg);
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  modelName: string,
  seed: number,
): Promise<AIFood[]> {
  void validateGeminiModel(apiKey, modelName); // non-blocking

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUTS.model } });
  const temperature = 0.7 + (seed % 10) * 0.03;

  // Try the configured model, then the fallback; one short retry each for transient 429/503s.
  const models = [...new Set([modelName, GEMINI_FALLBACK_MODEL])];
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log("Gemini", `model=${model}  attempt=${attempt}  temp=${temperature.toFixed(2)}`);
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType:  "application/json",
            responseSchema:    GEMINI_SCHEMA,
            temperature,
            seed,
          },
        });
        const rawText = response.text;
        if (!rawText) throw new Error("Gemini returned an empty response");
        log("Gemini:RawResponse", rawText.slice(0, 2000));
        return parseModelOutput(rawText, "Gemini");
      } catch (err) {
        lastErr = err;
        if (!isTransientGeminiError(err)) throw err;
        console.warn(`[NutriPlan:Gemini] ${model} attempt ${attempt} failed (transient): ${(err as Error).message.slice(0, 160)}`);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ── Local model via OpenAI-compatible API ─────────────────────────────────────
async function callLocalModel(
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
  model: string,
  seed: number,
): Promise<AIFood[]> {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  log("LocalModel", `endpoint=${endpoint}  model=${model}  seed=${seed}`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUTS.local),
    body: JSON.stringify({
      model,
      seed,
      temperature: 0.7,
      response_format: { type: "json_schema", json_schema: { name: "meals", schema: LOCAL_JSON_SCHEMA, strict: true } },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Local model error: ${res.status} ${(await res.text()).slice(0, 200)}`);

  const data    = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Local model returned no content");
  log("LocalModel:RawResponse", content.slice(0, 2000));
  return parseModelOutput(content, "LocalModel");
}

// ── USDA nutrition cross-check ────────────────────────────────────────────────
async function crossCheckNutrition(
  foodName: string,
  estimate: Pick<AIFood, "estimatedCalories" | "estimatedProteinG" | "estimatedCarbsG" | "estimatedFatG" | "servingG">,
  usdaApiKey: string,
): Promise<{ calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; verified: boolean }> {
  const fallback = {
    calories: Math.round(estimate.estimatedCalories),
    proteinG: Math.round(estimate.estimatedProteinG * 10) / 10,
    carbsG:   Math.round(estimate.estimatedCarbsG * 10) / 10,
    fatG:     Math.round(estimate.estimatedFatG * 10) / 10,
    fiberG:   0,
    verified: false,
  };

  try {
    const url = new URL(`${USDA_API_BASE}/foods/search`);
    url.searchParams.set("query",    foodName);
    url.searchParams.set("pageSize", "3");
    url.searchParams.set("dataType", "SR Legacy,Foundation,Survey (FNDDS),Branded");

    const res = await fetch(url, {
      headers: { "X-Api-Key": usdaApiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUTS.usda),
    });
    if (!res.ok) throw new Error(`USDA ${res.status}`);

    const data = await res.json() as {
      foods?: Array<{
        description?: string;
        dataType?: string;
        foodNutrients: Array<{ nutrientId: number; value: number }>;
        servingSize?: number;
        servingSizeUnit?: string;
      }>;
    };

    const food = data.foods?.[0];
    if (!food) throw new Error("No USDA match");

    const get   = (id: number) => food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
    const base  = food.servingSize && food.servingSizeUnit === "g" ? food.servingSize : 100;
    const scale = estimate.servingG / base;

    const usdaCal = Math.round(get(NUTRIENT_IDS.calories) * scale);
    // Only accept the USDA figure when it is in the same ballpark as the model's
    // estimate — a generic match ("Rice, raw") for a composed dish is worse than the estimate.
    if (usdaCal > 0 && Math.abs(usdaCal - estimate.estimatedCalories) / estimate.estimatedCalories < 0.6) {
      log("USDA:Used", `food="${foodName}" matched="${food.description}" cal=${usdaCal}`);
      return {
        calories: usdaCal,
        proteinG: Math.round(get(NUTRIENT_IDS.protein) * scale * 10) / 10,
        carbsG:   Math.round(get(NUTRIENT_IDS.carbs)   * scale * 10) / 10,
        fatG:     Math.round(get(NUTRIENT_IDS.fat)      * scale * 10) / 10,
        fiberG:   Math.round(get(NUTRIENT_IDS.fiber)    * scale * 10) / 10,
        verified: true,
      };
    }
    throw new Error(`USDA cal=${usdaCal} vs AI est=${estimate.estimatedCalories} — too far off`);
  } catch (err) {
    log("USDA:Fallback", `food="${foodName}"  reason=${(err as Error).message}`);
    return fallback;
  }
}

// ── Image search ─────────────────────────────────────────────────────────────
async function getFoodImage(foodName: string, category: string): Promise<string> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return imageForCategory(category);

  const requestUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${foodName} food`)}&per_page=1&orientation=landscape`;
  try {
    const res = await fetch(requestUrl, {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUTS.unsplash),
    });
    if (res.ok) {
      const data = await res.json() as { results?: Array<{ urls?: { small?: string } }> };
      const hit = data.results?.[0]?.urls?.small;
      if (isAllowedImageUrl(hit)) return hit;
    } else {
      log("Unsplash:Error", `food="${foodName}" status=${res.status}`);
    }
  } catch (err) {
    log("Unsplash:Error", `food="${foodName}" ${(err as Error).message}`);
  }
  return imageForCategory(category);
}

// ── Diet tag inference ────────────────────────────────────────────────────────
const MEAT_KW  = ["chicken", "mutton", "lamb", "beef", "pork", "fish", "salmon", "tuna", "prawn", "shrimp", "meat", "turkey", "keema", "rohu", "catla", "crab", "squid", "bacon", "ham", "sausage"];
const EGG_KW   = ["egg", "omelette", "omelet", "anda"];
const DAIRY_KW = ["milk", "yogurt", "yoghurt", "curd", "dahi", "paneer", "cheese", "ghee", "butter", "lassi", "whey", "cottage", "raita", "kheer", "cream", "chaas"];

export function inferDietTags(name: string, carbsG: number): DietTag[] {
  const n = name.toLowerCase();
  const hasMeat  = MEAT_KW.some((k) => n.includes(k));
  const hasEgg   = EGG_KW.some((k) => n.includes(k));
  const hasDairy = DAIRY_KW.some((k) => n.includes(k));
  const isKeto   = carbsG <= 10;
  if (hasMeat) return ["non_veg", ...(isKeto ? ["keto" as const] : [])];
  const tags: DietTag[] = ["vegetarian", "non_veg"];
  if (!hasEgg && !hasDairy) tags.push("vegan");
  if (hasEgg)  tags.push("eggetarian");
  if (isKeto)  tags.push("keto");
  return [...new Set(tags)];
}

/** Drops items that visibly violate the requested diet (e.g. "Chicken curry" for a vegetarian). */
export function enforceDiet<T extends { name: string; carbsG: number }>(items: T[], dietType: DietTag): T[] {
  if (dietType === "non_veg" || dietType === "keto") return items;
  return items.filter((i) => inferDietTags(i.name, i.carbsG).includes(dietType));
}

const VALID_MEAL_TIMES = new Set<MealTime>(["breakfast", "lunch", "dinner", "snack"]);
export function normaliseMealTime(raw: string): MealTime {
  const v = raw.toLowerCase().trim().replace(/s$/, "") as MealTime;
  return VALID_MEAL_TIMES.has(v) ? v : "snack";
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAIMealPlan(params: MealPlanProfile, modelConfig: ModelConfig): Promise<AIMealItem[]> {
  const systemPrompt = modelConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPrompt   = buildUserPrompt(params);

  log("Plan", `provider=${modelConfig.provider}  dietType=${params.dietType}  calories=${params.targetCalories}  seed=${params.seed}`);

  let rawMeals: AIFood[];
  if (modelConfig.provider === "local") {
    if (!modelConfig.localBaseUrl || !modelConfig.localModel) {
      throw new Error("LOCAL_MODEL_BASE_URL and LOCAL_MODEL_NAME must be set for the local provider");
    }
    rawMeals = await callLocalModel(systemPrompt, userPrompt, modelConfig.localBaseUrl, modelConfig.localModel, params.seed);
  } else {
    if (!modelConfig.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
    rawMeals = await callGemini(systemPrompt, userPrompt, modelConfig.geminiApiKey, modelConfig.geminiModel ?? "gemini-2.5-flash", params.seed);
  }

  // Dedupe by name, then enforce the hard constraints the model may have ignored.
  const seen = new Set<string>();
  const unique = rawMeals.filter((m) => {
    const key = m.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const safe = excludeAllergens(
    enforceDiet(unique.map((m) => ({ ...m, carbsG: m.estimatedCarbsG })), params.dietType),
    params.allergies,
  );
  if (safe.length === 0) throw new Error("Model output violated diet/allergy constraints");
  log("Plan:Filtered", `${safe.length}/${rawMeals.length} meals kept after dedupe + diet + allergy filters`);

  // Cross-check nutrition + fetch image in parallel per item.
  const items = await Promise.all(
    safe.map(async (meal): Promise<AIMealItem> => {
      const [nutrition, image] = await Promise.all([
        crossCheckNutrition(meal.name, meal, params.usdaApiKey),
        getFoodImage(meal.name, meal.category),
      ]);
      return {
        name:        meal.name,
        description: meal.description,
        mealTime:    normaliseMealTime(meal.mealTime),
        servingSize: meal.servingSize,
        servingG:    meal.servingG,
        calories:    nutrition.calories,
        proteinG:    nutrition.proteinG,
        carbsG:      nutrition.carbsG,
        fatG:        nutrition.fatG,
        fiberG:      nutrition.fiberG,
        image,
        dietTags:    inferDietTags(meal.name, nutrition.carbsG),
        category:    meal.category,
        aiGenerated: true,
      };
    }),
  );

  log("Plan:Done", `${items.length} final meal items ready`);
  return items;
}
