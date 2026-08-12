// AI Meal Plan Generator
// Supports: Google Gemini 2.5 Flash (cloud) | Ollama-compatible local models
// Nutrition cross-check: USDA FoodData Central
// Images: Unsplash API (free, no key) with Pexels fallback

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { DietTag, MealTime } from "@/lib/food-data";

const DEV = process.env.NODE_ENV === "development";

function log(section: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[36m[NutriPlan:${section}]\x1b[0m`, ...args);
}
function logJSON(section: string, label: string, data: unknown) {
  if (!DEV) return;
  console.log(`\n\x1b[36m[NutriPlan:${section}]\x1b[0m \x1b[33m${label}\x1b[0m`);
  console.log(JSON.stringify(data, null, 2));
}

const USDA_API_BASE   = "https://api.nal.usda.gov/fdc/v1";
const NUTRIENT_IDS    = { calories: 1008, protein: 1003, fat: 1004, carbs: 1005, fiber: 1079 };
const GEMINI_LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Runs once per process — warns if the configured model isn't in ListModels
let _modelCheckPromise: Promise<void> | null = null;
function validateGeminiModel(apiKey: string, model: string): Promise<void> {
  if (_modelCheckPromise) return _modelCheckPromise;
  _modelCheckPromise = (async () => {
    try {
      const res  = await fetch(`${GEMINI_LIST_URL}?key=${apiKey}&pageSize=200`);
      if (!res.ok) { log("Gemini:ModelCheck", `ListModels returned ${res.status} — skipping check`); return; }
      const data = await res.json() as { models?: Array<{ name: string }> };
      const ids  = (data.models ?? []).map((m) => m.name.replace("models/", ""));
      if (ids.includes(model)) {
        log("Gemini:ModelCheck", `✓ "${model}" found in ListModels`);
      } else {
        console.warn(`\x1b[33m[NutriPlan:Gemini:ModelCheck] ⚠ "${model}" NOT in ListModels. Available: ${ids.join(", ")}\x1b[0m`);
      }
    } catch (err) {
      log("Gemini:ModelCheck", `ListModels fetch failed: ${(err as Error).message}`);
    }
  })();
  return _modelCheckPromise;
}

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

interface AIFood {
  name: string;
  description: string;
  mealTime: "breakfast" | "lunch" | "dinner" | "snack";
  servingSize: string;
  servingG: number;
  estimatedCalories: number;
  estimatedProteinG: number;
  estimatedCarbsG: number;
  estimatedFatG: number;
  category: string;
}

export type ModelProvider = "gemini" | "local";

export interface ModelConfig {
  provider: ModelProvider;
  geminiApiKey?: string;
  localBaseUrl?: string;   // e.g. http://localhost:11434/v1  (Ollama OpenAI-compat)
  localModel?: string;     // e.g. llama3.2, mistral, phi3
  systemPrompt?: string;   // editable system prompt override
}

// ── Default system prompt (editable at code level) ────────────────────────────
export const DEFAULT_SYSTEM_PROMPT = `You are a certified nutritionist and culinary expert specializing in Indian and global cuisine.

STRICT RULES:
- Strong preference for Indian foods: dal, roti, chapati, rice dishes, sabzi, curry, idli, dosa, upma, poha, biryani, khichdi, paneer dishes, etc.
- No beef under any circumstances.
- All meal names must be completely unique — zero repetition across breakfast, lunch, dinner, and snacks.
- Each food must be realistic, commonly available, and nutritionally accurate.
- Descriptions must be appetizing, informative, and 1–2 sentences max.
- Nutrition values must be realistic per the specified serving size.
- Vary meals meaningfully when seed changes — different seed = genuinely different meals.`;

// ── Gemini structured output schema ──────────────────────────────────────────
const GEMINI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    meals: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:               { type: SchemaType.STRING },
          description:        { type: SchemaType.STRING },
          mealTime:           { type: SchemaType.STRING },
          servingSize:        { type: SchemaType.STRING },
          servingG:           { type: SchemaType.NUMBER },
          estimatedCalories:  { type: SchemaType.NUMBER },
          estimatedProteinG:  { type: SchemaType.NUMBER },
          estimatedCarbsG:    { type: SchemaType.NUMBER },
          estimatedFatG:      { type: SchemaType.NUMBER },
          category:           { type: SchemaType.STRING },
        },
        required: ["name","description","mealTime","servingSize","servingG",
                   "estimatedCalories","estimatedProteinG","estimatedCarbsG",
                   "estimatedFatG","category"],
      },
    },
  },
  required: ["meals"],
};

// ── User prompt builder ───────────────────────────────────────────────────────
function buildUserPrompt(params: {
  age: number; gender: string; weightKg: number; heightCm: number;
  goal: string; activityLevel: string; dietType: DietTag;
  allergies: string[]; targetCalories: number;
  proteinG: number; carbsG: number; fatG: number; seed: number;
}): string {
  const goalDesc = {
    lose:     "weight loss (calorie deficit)",
    maintain: "weight maintenance",
    gain:     "muscle gain (calorie surplus)",
  }[params.goal] ?? params.goal;

  const dietNote: Record<DietTag, string> = {
    non_veg:    "Include meat, fish, eggs, and dairy. Prefer Indian non-veg dishes.",
    vegetarian: "No meat or fish. Eggs and dairy allowed. Prefer Indian vegetarian dishes.",
    vegan:      "No animal products — no meat, fish, eggs, or dairy.",
    eggetarian: "No meat or fish. Eggs and dairy allowed. Prefer Indian dishes.",
    keto:       "High fat, very low carb (under 20g net carbs total). No grains or sugar.",
  };

  const allergyLine = params.allergies.length > 0
    ? `Strictly avoid these allergens: ${params.allergies.join(", ")}.`
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

// ── Gemini 2.5 Flash ──────────────────────────────────────────────────────────
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  seed: number,
): Promise<AIFood[]> {
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  await validateGeminiModel(apiKey, modelName);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema:   GEMINI_SCHEMA as never,
      temperature:      0.7 + (seed % 10) * 0.03,
    },
  });

  log("Gemini", `model=${modelName}  temp=${(0.7 + (seed % 10) * 0.03).toFixed(2)}`);
  log("Gemini:SystemPrompt", systemPrompt);
  log("Gemini:UserPrompt", userPrompt);

  const result   = await model.generateContent(userPrompt);
  const rawText  = result.response.text();
  log("Gemini:RawResponse", rawText);

  const raw = JSON.parse(rawText) as { meals: AIFood[] };
  logJSON("Gemini:ParsedMeals", `${raw.meals?.length ?? 0} meals returned`, raw.meals);
  return raw.meals ?? [];
}

// ── Local model via Ollama OpenAI-compatible API ───────────────────────────────
async function callLocalModel(
  systemPrompt: string,
  userPrompt: string,
  baseUrl: string,
  model: string,
  seed: number,
): Promise<AIFood[]> {
  const jsonSchema = {
    type: "object",
    properties: {
      meals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:              { type: "string" },
            description:       { type: "string" },
            mealTime:          { type: "string", enum: ["breakfast","lunch","dinner","snack"] },
            servingSize:       { type: "string" },
            servingG:          { type: "number" },
            estimatedCalories: { type: "number" },
            estimatedProteinG: { type: "number" },
            estimatedCarbsG:   { type: "number" },
            estimatedFatG:     { type: "number" },
            category:          { type: "string" },
          },
          required: ["name","description","mealTime","servingSize","servingG",
                     "estimatedCalories","estimatedProteinG","estimatedCarbsG",
                     "estimatedFatG","category"],
        },
      },
    },
    required: ["meals"],
  };

  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  log("LocalModel", `endpoint=${endpoint}  model=${model}  seed=${seed}`);
  log("LocalModel:SystemPrompt", systemPrompt);
  log("LocalModel:UserPrompt", userPrompt);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      seed,
      temperature: 0.7,
      response_format: { type: "json_schema", json_schema: { name: "meals", schema: jsonSchema, strict: true } },
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    log("LocalModel:Error", `${res.status} ${errText}`);
    throw new Error(`Local model error: ${res.status} ${errText}`);
  }

  const data    = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0].message.content;
  log("LocalModel:RawResponse", content);

  const raw = JSON.parse(content) as { meals: AIFood[] };
  logJSON("LocalModel:ParsedMeals", `${raw.meals?.length ?? 0} meals returned`, raw.meals);
  return raw.meals ?? [];
}

// ── USDA nutrition cross-check ────────────────────────────────────────────────
async function crossCheckNutrition(
  foodName: string,
  estimate: Pick<AIFood, "estimatedCalories"|"estimatedProteinG"|"estimatedCarbsG"|"estimatedFatG"|"servingG">,
  usdaApiKey: string,
): Promise<{ calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }> {
  try {
    const url = new URL(`${USDA_API_BASE}/foods/search`);
    url.searchParams.set("api_key",  usdaApiKey);
    url.searchParams.set("query",    foodName);
    url.searchParams.set("pageSize", "3");
    url.searchParams.set("dataType", "SR Legacy,Foundation,Survey (FNDDS),Branded");

    log("USDA:Request", `food="${foodName}"  url=${url.toString().replace(usdaApiKey, "<key>")}`);

    const res  = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("USDA unavailable");

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
    log("USDA:Response", `food="${foodName}"  matched=${
      food ? `"${food.description}" (${food.dataType})` : "NO MATCH — using AI estimate"
    }`);

    if (!food) throw new Error("No USDA match");

    const get  = (id: number) => food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
    const base = food.servingSize && food.servingSizeUnit === "g" ? food.servingSize : 100;
    const scale = estimate.servingG / base;

    const usdaCal = Math.round(get(NUTRIENT_IDS.calories) * scale);
    if (usdaCal > 0 && Math.abs(usdaCal - estimate.estimatedCalories) / estimate.estimatedCalories < 3) {
      const result = {
        calories: usdaCal,
        proteinG: Math.round(get(NUTRIENT_IDS.protein) * scale * 10) / 10,
        carbsG:   Math.round(get(NUTRIENT_IDS.carbs)   * scale * 10) / 10,
        fatG:     Math.round(get(NUTRIENT_IDS.fat)      * scale * 10) / 10,
        fiberG:   Math.round(get(NUTRIENT_IDS.fiber)    * scale * 10) / 10,
      };
      log("USDA:Used", `food="${foodName}"  cal=${result.calories} P=${result.proteinG}g C=${result.carbsG}g F=${result.fatG}g`);
      return result;
    }
    throw new Error(`USDA cal=${usdaCal} vs AI est=${estimate.estimatedCalories} — too far off, using AI estimate`);
  } catch (err) {
    log("USDA:Fallback", `food="${foodName}"  reason=${(err as Error).message}`);
    return {
      calories: estimate.estimatedCalories,
      proteinG: estimate.estimatedProteinG,
      carbsG:   estimate.estimatedCarbsG,
      fatG:     estimate.estimatedFatG,
      fiberG:   0,
    };
  }
}

// ── Image search — Unsplash (free, no key) with static fallback ───────────────
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  dal:       "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
  rice:      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  bread:     "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80",
  chicken:   "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  fish:      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
  egg:       "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80",
  vegetable: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  dairy:     "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
  fruit:     "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
  nuts:      "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  snack:     "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  default:   "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
};

async function getFoodImage(foodName: string, category: string): Promise<string> {
  const query       = encodeURIComponent(`${foodName} food`);
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY ?? "";
  const requestUrl  = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`;

  log("Unsplash:Request", `food="${foodName}"  url=${requestUrl}  hasKey=${!!unsplashKey}`);

  try {
    const res = await fetch(requestUrl, {
      headers: { Authorization: `Client-ID ${unsplashKey}` },
      cache: "no-store",
    });

    log("Unsplash:Response", `food="${foodName}"  status=${res.status}`);

    if (res.ok) {
      const data = await res.json() as { results: Array<{ urls: { small: string }; description: string | null }> };
      const hit  = data.results?.[0];
      if (hit?.urls?.small) {
        log("Unsplash:Hit", `food="${foodName}"  imageUrl=${hit.urls.small}  desc="${hit.description ?? ""}"`);
        return hit.urls.small;
      }
      log("Unsplash:Miss", `food="${foodName}"  no results — using category fallback`);
    } else {
      log("Unsplash:Error", `food="${foodName}"  status=${res.status} — using category fallback`);
    }
  } catch (err) {
    log("Unsplash:Error", `food="${foodName}"  ${(err as Error).message} — using category fallback`);
  }

  const fallback = CATEGORY_FALLBACK_IMAGES[category] ?? CATEGORY_FALLBACK_IMAGES.default;
  log("Unsplash:Fallback", `food="${foodName}"  category="${category}"  url=${fallback}`);
  return fallback;
}

// ── Diet tag inference ────────────────────────────────────────────────────────
const MEAT_KW  = ["chicken","mutton","lamb","beef","pork","fish","salmon","tuna","prawn","shrimp","meat","turkey","keema"];
const EGG_KW   = ["egg"];
const DAIRY_KW = ["milk","yogurt","curd","paneer","cheese","ghee","butter","lassi","whey","cottage","raita"];

function inferDietTags(name: string, carbsG: number): string[] {
  const n = name.toLowerCase();
  const hasMeat  = MEAT_KW.some((k) => n.includes(k));
  const hasEgg   = EGG_KW.some((k) => n.includes(k));
  const hasDairy = DAIRY_KW.some((k) => n.includes(k));
  const isKeto   = carbsG <= 10;
  if (hasMeat) return ["non_veg", ...(isKeto ? ["keto"] : [])];
  const tags = ["vegetarian", "non_veg"];
  if (!hasEgg && !hasDairy) tags.push("vegan");
  if (hasEgg)  tags.push("eggetarian");
  if (isKeto)  tags.push("keto");
  return [...new Set(tags)];
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAIMealPlan(
  params: {
    age: number; gender: string; weightKg: number; heightCm: number;
    goal: string; activityLevel: string; dietType: DietTag;
    allergies: string[]; targetCalories: number;
    proteinG: number; carbsG: number; fatG: number;
    seed: number; usdaApiKey: string;
  },
  modelConfig: ModelConfig,
): Promise<AIMealItem[]> {
  const systemPrompt = modelConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPrompt   = buildUserPrompt(params);

  log("Plan", `provider=${modelConfig.provider}  dietType=${params.dietType}  calories=${params.targetCalories}  seed=${params.seed}`);

  // ── Call the selected model ──
  let rawMeals: AIFood[];

  if (modelConfig.provider === "local") {
    if (!modelConfig.localBaseUrl || !modelConfig.localModel) {
      throw new Error("LOCAL_MODEL_BASE_URL and LOCAL_MODEL_NAME must be set for local provider");
    }
    rawMeals = await callLocalModel(
      systemPrompt, userPrompt,
      modelConfig.localBaseUrl, modelConfig.localModel, params.seed,
    );
  } else {
    if (!modelConfig.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
    rawMeals = await callGemini(systemPrompt, userPrompt, modelConfig.geminiApiKey, params.seed);
  }

  // ── Dedupe by name ──
  const seen   = new Set<string>();
  const unique = rawMeals.filter((m) => {
    const key = m.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log("Plan:Deduped", `${unique.length}/${rawMeals.length} unique meals after dedup`);

  // ── Cross-check nutrition + fetch image in parallel ──
  const items = await Promise.all(
    unique.map(async (meal): Promise<AIMealItem> => {
      const [nutrition, image] = await Promise.all([
        crossCheckNutrition(meal.name, meal, params.usdaApiKey),
        getFoodImage(meal.name, meal.category),
      ]);

      return {
        name:        meal.name,
        description: meal.description,
        mealTime:    meal.mealTime as MealTime,
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
    })
  );

  log("Plan:Done", `${items.length} final meal items ready`);
  logJSON("Plan:FinalItems", "Final meal plan", items.map((i) => ({
    name: i.name, mealTime: i.mealTime, calories: i.calories,
    proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, image: i.image,
  })));

  return items;
}
