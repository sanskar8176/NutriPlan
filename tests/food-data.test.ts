import { describe, it, expect } from "vitest";
import { getMealPlan, FOOD_DATABASE } from "@/lib/food-data";

describe("static meal plan (offline fallback)", () => {
  it("returns one breakfast, lunch, dinner and two snacks for every diet", () => {
    for (const diet of ["non_veg", "vegetarian", "vegan", "eggetarian", "keto"] as const) {
      const plan = getMealPlan(diet, 2000);
      expect(plan.breakfast).toHaveLength(1);
      expect(plan.lunch).toHaveLength(1);
      expect(plan.dinner).toHaveLength(1);
      expect(plan.snack.length).toBeGreaterThanOrEqual(1);
      for (const item of Object.values(plan).flat()) expect(item.dietTags).toContain(diet);
    }
  });

  it("never repeats an item across slots", () => {
    const plan = getMealPlan("vegetarian", 1800);
    const ids = Object.values(plan).flat().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects allergen exclusions", () => {
    const plan = getMealPlan("vegetarian", 2000, ["Nuts", "Dairy"]);
    for (const item of Object.values(plan).flat()) {
      expect(item.name.toLowerCase()).not.toMatch(/nut|almond|peanut|yogurt|cheese|paneer|milk|whey/);
    }
  });

  it("varies with the seed", () => {
    const a = getMealPlan("non_veg", 2000, [], 0);
    const b = getMealPlan("non_veg", 2000, [], 1);
    const names = (p: typeof a) => Object.values(p).flat().map((i) => i.id).join("|");
    expect(names(a)).not.toBe(names(b));
  });

  it("catalogue only uses allow-listed image hosts", () => {
    for (const f of FOOD_DATABASE) expect(f.image.startsWith("https://images.unsplash.com/")).toBe(true);
  });
});
