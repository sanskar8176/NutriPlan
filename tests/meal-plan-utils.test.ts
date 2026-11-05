import { describe, it, expect } from "vitest";
import { fillMissingSlots, isCompletePlan, emptyMeals } from "@/lib/meal-plan-utils";
import { foodMatchesAllergy } from "@/lib/allergens";
import type { FoodItem } from "@/lib/food-data";

const item = (id: string, name: string): FoodItem => ({
  id, name, calories: 100, proteinG: 1, carbsG: 1, fatG: 1, mealTime: ["snack"], dietTags: ["vegan"], image: "https://images.unsplash.com/x", servingSize: "1",
});

describe("fillMissingSlots", () => {
  it("tops up only the short slots and never repeats a dish", () => {
    const primary = { ...emptyMeals(), breakfast: [item("a", "Poha")], snack: [item("b", "Roasted Chana")] };
    const fallback = {
      breakfast: [item("f1", "Oats")],
      lunch: [item("f2", "Dal Rice")],
      dinner: [item("f3", "Khichdi")],
      snack: [item("f4", "roasted chana"), item("f5", "Fruit Chaat"), item("f6", "Sprouts")],
    };
    const { meals, filled } = fillMissingSlots(primary, fallback);
    expect(meals.breakfast.map((i) => i.name)).toEqual(["Poha"]);
    expect(meals.lunch.map((i) => i.name)).toEqual(["Dal Rice"]);
    expect(meals.dinner.map((i) => i.name)).toEqual(["Khichdi"]);
    expect(meals.snack.map((i) => i.name)).toEqual(["Roasted Chana", "Fruit Chaat"]);
    expect(filled).toBe(3);
    expect(isCompletePlan(meals)).toBe(true);
  });

  it("reports incomplete plans", () => {
    expect(isCompletePlan(emptyMeals())).toBe(false);
  });
});

describe("allergen exceptions", () => {
  it("does not flag plant milks or peanut butter as dairy", () => {
    expect(foodMatchesAllergy({ name: "Oats with Almond Milk" }, ["Dairy"])).toBe(false);
    expect(foodMatchesAllergy({ name: "Chana Masala in Coconut Milk" }, ["Dairy"])).toBe(false);
    expect(foodMatchesAllergy({ name: "Toast with Peanut Butter" }, ["Dairy"])).toBe(false);
  });
  it("still flags real dairy next to an exception phrase", () => {
    expect(foodMatchesAllergy({ name: "Coconut Milk Kheer" }, ["Dairy"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Paneer in Coconut Milk" }, ["Dairy"])).toBe(true);
  });
  it("applies exceptions per allergy (peanut butter is nuts even though it is not dairy)", () => {
    expect(foodMatchesAllergy({ name: "Apple with Peanut Butter" }, ["Nuts", "Dairy"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Apple with Peanut Butter" }, ["Dairy"])).toBe(false);
  });
  it("does not flag coconut or nutmeg as nuts, nor eggplant as eggs", () => {
    expect(foodMatchesAllergy({ name: "Coconut Chutney" }, ["Nuts"])).toBe(false);
    expect(foodMatchesAllergy({ name: "Baingan Bharta (Eggplant)" }, ["Eggs"])).toBe(false);
    expect(foodMatchesAllergy({ name: "Cashew Curry" }, ["Nuts"])).toBe(true);
  });
});
