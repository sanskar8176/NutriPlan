import { excludeAllergens } from "@/lib/allergens";

export type MealTime = "breakfast" | "lunch" | "dinner" | "snack";
export type DietTag = "non_veg" | "vegetarian" | "vegan" | "eggetarian" | "keto";

export interface FoodItem {
  id: string;
  name: string;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealTime: MealTime[];
  dietTags: DietTag[];
  image: string;
  servingSize: string;
  aiGenerated?: boolean;
}

export const FOOD_DATABASE: FoodItem[] = [
  // Breakfast
  {
    id: "oatmeal-berries",
    name: "Oatmeal with Mixed Berries",
    calories: 320, proteinG: 10, carbsG: 58, fatG: 6,
    mealTime: ["breakfast"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
    servingSize: "1 bowl (300g)",
  },
  {
    id: "eggs-avocado-toast",
    name: "Eggs & Avocado Toast",
    calories: 420, proteinG: 22, carbsG: 32, fatG: 24,
    mealTime: ["breakfast"],
    dietTags: ["vegetarian", "eggetarian"],
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80",
    servingSize: "2 eggs + 1 slice toast",
  },
  {
    id: "greek-yogurt-granola",
    name: "Greek Yogurt & Granola",
    calories: 350, proteinG: 20, carbsG: 45, fatG: 8,
    mealTime: ["breakfast", "snack"],
    dietTags: ["vegetarian", "eggetarian"],
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
    servingSize: "200g yogurt + 40g granola",
  },
  {
    id: "chicken-omelette",
    name: "Chicken & Veggie Omelette",
    calories: 380, proteinG: 35, carbsG: 8, fatG: 22,
    mealTime: ["breakfast"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80",
    servingSize: "3 eggs + 80g chicken",
  },
  {
    id: "smoothie-bowl",
    name: "Acai Smoothie Bowl",
    calories: 380, proteinG: 8, carbsG: 72, fatG: 9,
    mealTime: ["breakfast"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80",
    servingSize: "1 bowl (350g)",
  },
  {
    id: "keto-bacon-eggs",
    name: "Bacon & Scrambled Eggs",
    calories: 450, proteinG: 30, carbsG: 2, fatG: 36,
    mealTime: ["breakfast"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&q=80",
    servingSize: "3 eggs + 3 strips bacon",
  },
  // Lunch
  {
    id: "grilled-chicken-salad",
    name: "Grilled Chicken Salad",
    calories: 450, proteinG: 42, carbsG: 18, fatG: 22,
    mealTime: ["lunch"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
    servingSize: "1 large bowl",
  },
  {
    id: "lentil-soup",
    name: "Red Lentil Soup",
    calories: 320, proteinG: 18, carbsG: 52, fatG: 5,
    mealTime: ["lunch", "dinner"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
    servingSize: "1 bowl (400ml)",
  },
  {
    id: "quinoa-bowl",
    name: "Quinoa Power Bowl",
    calories: 480, proteinG: 22, carbsG: 65, fatG: 14,
    mealTime: ["lunch"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
    servingSize: "1 bowl (400g)",
  },
  {
    id: "tuna-wrap",
    name: "Tuna & Veggie Wrap",
    calories: 420, proteinG: 35, carbsG: 38, fatG: 12,
    mealTime: ["lunch"],
    dietTags: ["non_veg"],
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
    servingSize: "1 large wrap",
  },
  {
    id: "paneer-bowl",
    name: "Paneer & Chickpea Bowl",
    calories: 460, proteinG: 28, carbsG: 42, fatG: 18,
    mealTime: ["lunch", "dinner"],
    dietTags: ["vegetarian", "eggetarian"],
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
    servingSize: "1 bowl (350g)",
  },
  {
    id: "salmon-salad",
    name: "Salmon & Avocado Salad",
    calories: 520, proteinG: 38, carbsG: 12, fatG: 34,
    mealTime: ["lunch"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80",
    servingSize: "1 plate (350g)",
  },
  // Dinner
  {
    id: "grilled-salmon-veggies",
    name: "Grilled Salmon with Roasted Veggies",
    calories: 580, proteinG: 45, carbsG: 28, fatG: 28,
    mealTime: ["dinner"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
    servingSize: "200g salmon + 200g veggies",
  },
  {
    id: "chicken-rice-bowl",
    name: "Chicken & Brown Rice Bowl",
    calories: 620, proteinG: 48, carbsG: 68, fatG: 14,
    mealTime: ["dinner"],
    dietTags: ["non_veg"],
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
    servingSize: "1 bowl (450g)",
  },
  {
    id: "veggie-stir-fry",
    name: "Tofu & Veggie Stir Fry",
    calories: 420, proteinG: 24, carbsG: 48, fatG: 14,
    mealTime: ["dinner"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80",
    servingSize: "1 plate (400g)",
  },
  {
    id: "beef-broccoli",
    name: "Beef & Broccoli",
    calories: 540, proteinG: 42, carbsG: 22, fatG: 28,
    mealTime: ["dinner"],
    dietTags: ["non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
    servingSize: "1 plate (400g)",
  },
  {
    id: "dal-rice",
    name: "Dal Tadka with Basmati Rice",
    calories: 480, proteinG: 20, carbsG: 78, fatG: 10,
    mealTime: ["dinner"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
    servingSize: "1 bowl dal + 1 cup rice",
  },
  // Snacks
  {
    id: "almonds",
    name: "Mixed Nuts",
    calories: 180, proteinG: 6, carbsG: 8, fatG: 16,
    mealTime: ["snack"],
    dietTags: ["vegetarian", "vegan", "eggetarian", "keto", "non_veg"],
    image: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&q=80",
    servingSize: "30g",
  },
  {
    id: "protein-shake",
    name: "Whey Protein Shake",
    calories: 160, proteinG: 28, carbsG: 8, fatG: 2,
    mealTime: ["snack"],
    dietTags: ["vegetarian", "eggetarian", "non_veg"],
    image: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&q=80",
    servingSize: "1 scoop (30g) + 250ml milk",
  },
  {
    id: "apple-peanut-butter",
    name: "Apple with Peanut Butter",
    calories: 220, proteinG: 6, carbsG: 32, fatG: 10,
    mealTime: ["snack"],
    dietTags: ["vegetarian", "vegan", "eggetarian"],
    image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
    servingSize: "1 medium apple + 2 tbsp PB",
  },
  {
    id: "cottage-cheese",
    name: "Cottage Cheese with Berries",
    calories: 200, proteinG: 22, carbsG: 18, fatG: 4,
    mealTime: ["snack"],
    dietTags: ["vegetarian", "eggetarian", "keto"],
    image: "https://images.unsplash.com/photo-1559181567-c3190ca9be46?w=400&q=80",
    servingSize: "150g cottage cheese + 50g berries",
  },
  // Nut-free, dairy-free snacks so vegan + allergy combinations still get two snacks
  {
    id: "roasted-chana",
    name: "Roasted Chana (Chickpeas)",
    description: "Crunchy oven-roasted chickpeas tossed with chaat masala.",
    calories: 180, proteinG: 9, carbsG: 27, fatG: 4,
    mealTime: ["snack"],
    dietTags: ["vegetarian", "vegan", "eggetarian", "non_veg"],
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
    servingSize: "50g",
  },
  {
    id: "fruit-chaat",
    name: "Seasonal Fruit Chaat",
    description: "Papaya, guava, apple and pomegranate with a squeeze of lime and black salt.",
    calories: 150, proteinG: 2, carbsG: 36, fatG: 1,
    mealTime: ["snack", "breakfast"],
    dietTags: ["vegetarian", "vegan", "eggetarian", "non_veg"],
    image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80",
    servingSize: "1 bowl (250g)",
  },
  {
    id: "sprouts-salad",
    name: "Moong Sprouts Salad",
    description: "Protein-rich sprouted moong with cucumber, tomato, onion and lemon.",
    calories: 160, proteinG: 11, carbsG: 24, fatG: 2,
    mealTime: ["snack", "breakfast"],
    dietTags: ["vegetarian", "vegan", "eggetarian", "non_veg"],
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
    servingSize: "1 bowl (150g)",
  },
  {
    id: "boiled-eggs-snack",
    name: "Boiled Eggs with Black Pepper",
    description: "Two boiled eggs, a keto-friendly protein snack.",
    calories: 155, proteinG: 13, carbsG: 1, fatG: 11,
    mealTime: ["snack", "breakfast"],
    dietTags: ["eggetarian", "non_veg", "keto"],
    image: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80",
    servingSize: "2 eggs",
  },
];

/** Static food id → item lookup (used when a static-fallback plan is saved). */
export const FOOD_BY_ID: ReadonlyMap<string, FoodItem> = new Map(FOOD_DATABASE.map((f) => [f.id, f]));

/**
 * Offline / last-resort meal plan from the bundled catalogue.
 * Deterministic for a given (targetCalories, seed) pair so "Regenerate" rotates
 * through the catalogue instead of returning the same five items.
 */
export function getMealPlan(
  dietType: DietTag,
  targetCalories: number,
  allergies: string[] = [],
  seed = 0,
): Record<MealTime, FoodItem[]> {
  const filtered = excludeAllergens(
    FOOD_DATABASE.filter((f) => f.dietTags.includes(dietType)),
    allergies,
  );

  const rotation = Math.abs(Math.round(targetCalories) + seed);
  const used = new Set<string>();

  const pick = (time: MealTime, count: number): FoodItem[] => {
    const pool = filtered.filter((f) => f.mealTime.includes(time) && !used.has(f.id));
    if (pool.length === 0) return [];
    const offset = rotation % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    const picked = rotated.slice(0, count);
    picked.forEach((f) => used.add(f.id));
    return picked;
  };

  return {
    breakfast: pick("breakfast", 1),
    lunch: pick("lunch", 1),
    dinner: pick("dinner", 1),
    snack: pick("snack", 2),
  };
}
