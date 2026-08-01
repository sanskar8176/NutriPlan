// USDA FoodData Central API — food seed helper
// Docs: https://fdc.nal.usda.gov/api-guide.html

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const TOTAL_CAP     = 1000;
const PAGE_SIZE     = 25;
const PAGES_PER_KW  = 4; // fetch up to 4 pages = 100 results per keyword

// ── Search keywords ───────────────────────────────────────────────────────────
// Indian foods first (priority), then universal staples.
// "branded" flag = also include Branded dataType (needed for Indian foods
// which are rarely in SR Legacy / Foundation).
const SEARCH_KEYWORDS: { q: string; category: string; branded?: boolean }[] = [
  // Indian — lentils & legumes
  { q: "dal",                      category: "dal",       branded: true },
  { q: "lentil cooked",            category: "dal" },
  { q: "chana",                    category: "chickpea",  branded: true },
  { q: "chickpea cooked",          category: "chickpea" },
  { q: "rajma",                    category: "legume",    branded: true },
  { q: "kidney bean cooked",       category: "legume" },
  { q: "moong dal",                category: "dal",       branded: true },
  { q: "moong bean cooked",        category: "legume" },
  { q: "urad dal",                 category: "dal",       branded: true },
  { q: "masoor dal",               category: "dal",       branded: true },
  { q: "toor dal",                 category: "dal",       branded: true },
  // Indian — grains & bread
  { q: "roti",                     category: "bread",     branded: true },
  { q: "chapati",                  category: "bread",     branded: true },
  { q: "whole wheat flatbread",    category: "bread" },
  { q: "basmati rice cooked",      category: "rice" },
  { q: "basmati rice",             category: "rice",      branded: true },
  { q: "brown rice cooked",        category: "rice" },
  { q: "idli",                     category: "bread",     branded: true },
  { q: "dosa",                     category: "bread",     branded: true },
  { q: "poha",                     category: "rice",      branded: true },
  { q: "flattened rice",           category: "rice" },
  { q: "upma",                     category: "grain",     branded: true },
  { q: "semolina cooked",          category: "grain" },
  { q: "paratha",                  category: "bread",     branded: true },
  { q: "naan bread",               category: "bread",     branded: true },
  // Indian — dairy & protein
  { q: "paneer",                   category: "paneer",    branded: true },
  { q: "cottage cheese",           category: "paneer" },
  { q: "curd",                     category: "dairy",     branded: true },
  { q: "yogurt plain",             category: "dairy" },
  { q: "lassi",                    category: "dairy",     branded: true },
  { q: "ghee",                     category: "fat",       branded: true },
  { q: "clarified butter",         category: "fat" },
  { q: "buttermilk",               category: "dairy" },
  // Indian — vegetables & curries
  { q: "palak",                    category: "vegetable", branded: true },
  { q: "spinach cooked",           category: "vegetable" },
  { q: "aloo",                     category: "vegetable", branded: true },
  { q: "potato cooked",            category: "vegetable" },
  { q: "bhindi",                   category: "vegetable", branded: true },
  { q: "okra cooked",              category: "vegetable" },
  { q: "baingan",                  category: "vegetable", branded: true },
  { q: "eggplant cooked",          category: "vegetable" },
  { q: "gobi",                     category: "vegetable", branded: true },
  { q: "cauliflower cooked",       category: "vegetable" },
  { q: "matar",                    category: "vegetable", branded: true },
  { q: "green peas cooked",        category: "vegetable" },
  { q: "tomato cooked",            category: "vegetable" },
  { q: "onion cooked",             category: "vegetable" },
  { q: "mixed vegetables cooked",  category: "vegetable" },
  { q: "bitter gourd",             category: "vegetable", branded: true },
  { q: "drumstick moringa",        category: "vegetable", branded: true },
  // Indian — meat & fish
  { q: "chicken curry",            category: "chicken",   branded: true },
  { q: "chicken tikka",            category: "chicken",   branded: true },
  { q: "tandoori chicken",         category: "chicken",   branded: true },
  { q: "chicken cooked",           category: "chicken" },
  { q: "mutton curry",             category: "meat",      branded: true },
  { q: "lamb cooked",              category: "meat" },
  { q: "fish curry",               category: "fish",      branded: true },
  { q: "rohu fish",                category: "fish",      branded: true },
  { q: "catla fish",               category: "fish",      branded: true },
  { q: "fish cooked",              category: "fish" },
  { q: "prawn cooked",             category: "fish" },
  { q: "egg boiled",               category: "egg" },
  { q: "egg scrambled",            category: "egg" },
  { q: "egg curry",                category: "egg",       branded: true },
  // Indian — rice dishes & snacks
  { q: "khichdi",                  category: "rice",      branded: true },
  { q: "biryani",                  category: "rice",      branded: true },
  { q: "pulao",                    category: "rice",      branded: true },
  { q: "samosa",                   category: "snack",     branded: true },
  { q: "halwa",                    category: "snack",     branded: true },
  { q: "dhokla",                   category: "snack",     branded: true },
  { q: "pakora",                   category: "snack",     branded: true },
  { q: "chaat",                    category: "snack",     branded: true },
  { q: "vada",                     category: "snack",     branded: true },
  { q: "puri",                     category: "bread",     branded: true },
  { q: "uttapam",                  category: "bread",     branded: true },
  { q: "pesarattu",                category: "bread",     branded: true },
  // Universal — breakfast
  { q: "oatmeal cooked",           category: "oats" },
  { q: "rolled oats",              category: "oats" },
  { q: "banana raw",               category: "fruit" },
  { q: "apple raw",                category: "fruit" },
  { q: "mango raw",                category: "fruit" },
  { q: "orange raw",               category: "fruit" },
  { q: "papaya raw",               category: "fruit" },
  { q: "guava raw",                category: "fruit" },
  { q: "pomegranate raw",          category: "fruit" },
  { q: "watermelon raw",           category: "fruit" },
  { q: "grapes raw",               category: "fruit" },
  // Universal — protein
  { q: "chicken breast cooked",    category: "chicken" },
  { q: "salmon cooked",            category: "fish" },
  { q: "tuna canned",              category: "fish" },
  { q: "tofu firm",                category: "tofu" },
  { q: "whey protein powder",      category: "supplement", branded: true },
  { q: "soy protein",              category: "supplement" },
  { q: "tempeh cooked",            category: "tofu" },
  // Universal — nuts & seeds
  { q: "almonds raw",              category: "nuts" },
  { q: "peanut butter",            category: "nuts" },
  { q: "walnuts raw",              category: "nuts" },
  { q: "cashews raw",              category: "nuts" },
  { q: "peanuts roasted",          category: "nuts" },
  { q: "sunflower seeds",          category: "nuts" },
  { q: "chia seeds",               category: "nuts" },
  { q: "flaxseeds",                category: "nuts" },
  // Universal — dairy
  { q: "milk whole",               category: "dairy" },
  { q: "greek yogurt plain",       category: "dairy" },
  { q: "cheese cheddar",           category: "dairy" },
  { q: "milk skimmed",             category: "dairy" },
  // Universal — grains
  { q: "quinoa cooked",            category: "grain" },
  { q: "white rice cooked",        category: "rice" },
  { q: "whole wheat bread",        category: "bread" },
  { q: "pasta cooked",             category: "grain" },
  { q: "corn cooked",              category: "grain" },
  { q: "barley cooked",            category: "grain" },
  // Universal — vegetables
  { q: "broccoli cooked",          category: "vegetable" },
  { q: "carrot cooked",            category: "vegetable" },
  { q: "sweet potato cooked",      category: "vegetable" },
  { q: "mushroom cooked",          category: "vegetable" },
  { q: "bell pepper raw",          category: "vegetable" },
  { q: "cucumber raw",             category: "vegetable" },
  { q: "lettuce raw",              category: "vegetable" },
  { q: "kale cooked",              category: "vegetable" },
  // Universal — meat & fish
  { q: "beef cooked",              category: "meat" },
  { q: "pork cooked",              category: "meat" },
  { q: "turkey cooked",            category: "meat" },
  { q: "shrimp cooked",            category: "fish" },
  { q: "cod fish cooked",          category: "fish" },
  { q: "sardines canned",          category: "fish" },
];

// ── Category → image ──────────────────────────────────────────────────────────
const CATEGORY_IMAGES: Record<string, string> = {
  dal:        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
  chickpea:   "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
  legume:     "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
  bread:      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80",
  rice:       "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  grain:      "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
  paneer:     "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80",
  dairy:      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
  fat:        "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
  vegetable:  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  chicken:    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
  meat:       "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
  fish:       "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
  egg:        "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80",
  snack:      "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  oats:       "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
  fruit:      "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
  tofu:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  supplement: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&q=80",
  nuts:       "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
  default:    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
};

// ── Diet tag inference ────────────────────────────────────────────────────────
const MEAT_KW  = ["chicken","mutton","lamb","beef","pork","fish","salmon","tuna","prawn","shrimp","meat","turkey","rohu","catla","sardine","cod"];
const EGG_KW   = ["egg"];
const DAIRY_KW = ["milk","yogurt","curd","paneer","cheese","ghee","butter","lassi","whey","buttermilk","cottage"];

function inferDietTags(name: string, carbsPer100g: number): string[] {
  const n = name.toLowerCase();
  const hasMeat  = MEAT_KW.some((k) => n.includes(k));
  const hasEgg   = EGG_KW.some((k) => n.includes(k));
  const hasDairy = DAIRY_KW.some((k) => n.includes(k));
  const isKeto   = carbsPer100g <= 10;

  if (hasMeat) return ["non_veg", ...(isKeto ? ["keto"] : [])];

  const tags = ["vegetarian", "non_veg"];
  if (!hasEgg && !hasDairy) tags.push("vegan");
  if (hasEgg)  tags.push("eggetarian");
  if (isKeto)  tags.push("keto");
  return [...new Set(tags)];
}

// ── Meal time inference ───────────────────────────────────────────────────────
function inferMealTimes(name: string, category: string): string[] {
  const n = name.toLowerCase();
  const c = category.toLowerCase();

  if (["nuts", "supplement"].includes(c)) return ["snack"];
  if (["oats", "fruit"].includes(c))      return ["breakfast", "snack"];

  const isDairy      = ["yogurt","curd","lassi","milk","paneer","cheese","buttermilk","cottage"].some((h) => n.includes(h) || c === "dairy" || c === "paneer");
  const isTofu       = c === "tofu" || n.includes("tofu") || n.includes("tempeh");
  const isBreakfast  = ["oat","idli","dosa","poha","upma","egg","cereal","porridge","uttapam","pesarattu"].some((h) => n.includes(h) || c.includes(h));
  const isSnack      = ["samosa","halwa","sweet","cookie","bar","dhokla","pakora","chaat","vada"].some((h) => n.includes(h));
  const isDinnerMain = ["biryani","curry","mutton","lamb","salmon","steak","roast","tikka","tandoori","pulao"].some((h) => n.includes(h));

  if (isTofu)       return ["lunch", "dinner"];
  if (isDairy)      return ["breakfast", "snack", "lunch"];
  if (isDinnerMain) return ["lunch", "dinner"];

  const times = new Set<string>();
  if (isBreakfast) times.add("breakfast");
  if (isSnack)     times.add("snack");
  times.add("lunch");
  times.add("dinner");
  return [...times];
}

// ── USDA types & helpers ──────────────────────────────────────────────────────
const NUTRIENT_IDS = { calories: 1008, protein: 1003, fat: 1004, carbs: 1005, fiber: 1079 };

interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: Array<{ nutrientId: number; value: number }>;
  servingSize?: number;
  servingSizeUnit?: string;
}

function extractNutrient(food: USDAFood, id: number): number {
  return food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

export interface NormalizedFood {
  fdcId: number;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingSize: string;
  servingG: number;
  image: string;
  mealTimes: string[];
  dietTags: string[];
  category: string;
}

function normalizeFood(food: USDAFood, category: string): NormalizedFood | null {
  const calories = extractNutrient(food, NUTRIENT_IDS.calories);
  if (calories === 0) return null;

  const proteinG = extractNutrient(food, NUTRIENT_IDS.protein);
  const carbsG   = extractNutrient(food, NUTRIENT_IDS.carbs);
  const fatG     = extractNutrient(food, NUTRIENT_IDS.fat);
  const fiberG   = extractNutrient(food, NUTRIENT_IDS.fiber);

  const servingG = food.servingSize && food.servingSizeUnit === "g" ? food.servingSize : 100;
  const scale    = servingG / 100;

  const name = food.description
    .split(",")[0]
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  if (name.length < 2) return null;

  return {
    fdcId:       food.fdcId,
    name,
    calories:    Math.round(calories * scale),
    proteinG:    Math.round(proteinG * scale * 10) / 10,
    carbsG:      Math.round(carbsG   * scale * 10) / 10,
    fatG:        Math.round(fatG     * scale * 10) / 10,
    fiberG:      Math.round(fiberG   * scale * 10) / 10,
    servingSize: `${servingG}g`,
    servingG,
    image:     CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.default,
    mealTimes: inferMealTimes(name, category),
    dietTags:  inferDietTags(name, carbsG),
    category,
  };
}

async function fetchKeywordPage(
  q: string,
  category: string,
  apiKey: string,
  page: number,
  branded: boolean,
): Promise<NormalizedFood[]> {
  const dataTypes = branded
    ? "SR Legacy,Foundation,Survey (FNDDS),Branded"
    : "SR Legacy,Foundation,Survey (FNDDS)";

  const url = new URL(`${USDA_API_BASE}/foods/search`);
  url.searchParams.set("api_key",  apiKey);
  url.searchParams.set("query",    q);
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("pageNumber", String(page));
  url.searchParams.set("dataType", dataTypes);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json() as { foods?: USDAFood[]; totalHits?: number };
  return (data.foods ?? [])
    .map((f) => normalizeFood(f, category))
    .filter((f): f is NormalizedFood => f !== null);
}

// ── Public: fetch all keywords across multiple pages, dedupe by name ──────────
// On re-run: caller passes existingNames/existingFdcIds from DB so only
// genuinely new foods are returned — enabling additive re-seeding.
export async function fetchAllFoods(
  apiKey: string,
  existingNames: Set<string> = new Set(),
  existingFdcIds: Set<number> = new Set(),
): Promise<NormalizedFood[]> {
  const seenNames  = new Set<string>(existingNames);
  const seenFdcIds = new Set<number>(existingFdcIds);
  const result: NormalizedFood[] = [];

  for (const { q, category, branded = false } of SEARCH_KEYWORDS) {
    if (result.length >= TOTAL_CAP) break;

    for (let page = 1; page <= PAGES_PER_KW; page++) {
      if (result.length >= TOTAL_CAP) break;

      const foods = await fetchKeywordPage(q, category, apiKey, page, branded);
      if (foods.length === 0) break; // no more pages

      for (const food of foods) {
        if (result.length >= TOTAL_CAP) break;
        const key = food.name.toLowerCase().trim();
        if (seenNames.has(key) || seenFdcIds.has(food.fdcId)) continue;
        seenNames.add(key);
        seenFdcIds.add(food.fdcId);
        result.push(food);
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return result;
}
