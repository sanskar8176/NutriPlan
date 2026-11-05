// Pure helpers for assembling meal plans (client-safe, no server imports).
import type { FoodItem, MealTime } from "@/lib/food-data";
import type { MealsByTime } from "@/lib/types";

export const SLOT_TARGETS: Record<MealTime, number> = { breakfast: 1, lunch: 1, dinner: 1, snack: 2 };
export const MEAL_ORDER: MealTime[] = ["breakfast", "lunch", "dinner", "snack"];

export function emptyMeals(): MealsByTime {
  return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

/** True when every slot has at least its target number of items. */
export function isCompletePlan(meals: MealsByTime): boolean {
  return MEAL_ORDER.every((t) => (meals[t]?.length ?? 0) >= SLOT_TARGETS[t]);
}

/**
 * Fills slots that ended up short (e.g. the AI returned 5 meals but two were
 * dropped by the allergy/diet guard-rails) from a fallback plan, without
 * repeating a dish that is already present.
 */
export function fillMissingSlots(primary: MealsByTime, fallback: MealsByTime): { meals: MealsByTime; filled: number } {
  const used = new Set<string>(MEAL_ORDER.flatMap((t) => (primary[t] ?? []).map((i) => i.name.toLowerCase().trim())));
  const meals: MealsByTime = emptyMeals();
  let filled = 0;

  for (const t of MEAL_ORDER) {
    const items: FoodItem[] = [...(primary[t] ?? [])];
    for (const candidate of fallback[t] ?? []) {
      if (items.length >= SLOT_TARGETS[t]) break;
      const key = candidate.name.toLowerCase().trim();
      if (used.has(key)) continue;
      used.add(key);
      items.push(candidate);
      filled += 1;
    }
    meals[t] = items;
  }
  return { meals, filled };
}
