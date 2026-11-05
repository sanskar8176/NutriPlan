import { describe, it, expect } from "vitest";
import { allergenKeywordsFor, excludeAllergens, foodMatchesAllergy, normalizeAllergies } from "@/lib/allergens";

describe("normalizeAllergies", () => {
  it("lower-cases, trims, dedupes and drops blanks", () => {
    expect(normalizeAllergies([" Nuts ", "nuts", "", "Dairy"])).toEqual(["nuts", "dairy"]);
  });
  it("handles undefined", () => {
    expect(normalizeAllergies(undefined)).toEqual([]);
  });
});

describe("allergenKeywordsFor", () => {
  it("expands known categories into ingredient keywords", () => {
    const kws = allergenKeywordsFor(["Nuts"]);
    expect(kws).toContain("almond");
    expect(kws).toContain("peanut");
  });
  it("keeps unknown allergies as literal keywords", () => {
    expect(allergenKeywordsFor(["Mango"])).toEqual(["mango"]);
  });
});

describe("foodMatchesAllergy", () => {
  it("matches hidden dairy ingredients for a 'Dairy' exclusion", () => {
    expect(foodMatchesAllergy({ name: "Palak Paneer" }, ["Dairy"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Dal Tadka with Ghee" }, ["Dairy"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Masoor Dal" }, ["Dairy"])).toBe(false);
  });
  it("matches gluten carriers like roti and semolina", () => {
    expect(foodMatchesAllergy({ name: "Aloo Paratha" }, ["Gluten"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Rava Upma" }, ["Gluten"])).toBe(true);
    expect(foodMatchesAllergy({ name: "Steamed Rice" }, ["Gluten"])).toBe(false);
  });
  it("checks the description too", () => {
    expect(foodMatchesAllergy({ name: "Veg Salad", description: "topped with roasted peanuts" }, ["Nuts"])).toBe(true);
  });
  it("is a no-op with no allergies", () => {
    expect(foodMatchesAllergy({ name: "Peanut Chikki" }, [])).toBe(false);
  });
});

describe("excludeAllergens", () => {
  const items = [
    { name: "Mixed Nuts" },
    { name: "Egg Curry" },
    { name: "Prawn Masala" },
    { name: "Steamed Idli" },
  ];
  it("removes every matching item", () => {
    expect(excludeAllergens(items, ["Nuts", "Eggs", "Shellfish"]).map((i) => i.name)).toEqual(["Steamed Idli"]);
  });
  it("returns a copy when nothing is excluded", () => {
    const out = excludeAllergens(items, []);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
});
