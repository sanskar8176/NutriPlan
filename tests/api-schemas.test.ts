import { describe, it, expect } from "vitest";
import {
  mealPlanQuerySchema, savePlanBodySchema, registerSchema, loginSchema,
  resultsParamsSchema, searchParamsToObject,
} from "@/lib/api-schemas";

const validProfile = {
  age: "30", gender: "male", heightCm: "178", weightKg: "80",
  activityLevel: "moderate", goal: "lose", dietType: "vegetarian",
};

describe("mealPlanQuerySchema", () => {
  it("accepts a valid query string and coerces numbers", () => {
    const r = mealPlanQuerySchema.safeParse({ ...validProfile, allergies: "Nuts,Dairy", seed: "100" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.age).toBe(30);
      expect(r.data.allergies).toEqual(["Nuts", "Dairy"]);
      expect(r.data.seed).toBe(100);
    }
  });
  it("defaults seed and allergies when absent or empty", () => {
    const r = mealPlanQuerySchema.safeParse({ ...validProfile, allergies: "", seed: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.seed).toBe(0);
      expect(r.data.allergies).toEqual([]);
    }
  });
  it("rejects unknown enums and out-of-range numbers", () => {
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, gender: "robot" }).success).toBe(false);
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, activityLevel: "couch" }).success).toBe(false);
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, age: "7" }).success).toBe(false);
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, weightKg: "9999" }).success).toBe(false);
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, heightCm: "NaN" }).success).toBe(false);
  });
  it("rejects negative or huge seeds", () => {
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, seed: "-1" }).success).toBe(false);
    expect(mealPlanQuerySchema.safeParse({ ...validProfile, seed: "99999999" }).success).toBe(false);
  });
});

describe("savePlanBodySchema", () => {
  const body = {
    ...validProfile, age: 30, heightCm: 178, weightKg: 80,
    name: "My Plan", allergies: ["Nuts"],
    meals: [{ foodId: "abc", mealTime: "lunch", position: 0, aiGenerated: true }],
  };
  it("accepts a valid body", () => {
    expect(savePlanBodySchema.safeParse(body).success).toBe(true);
  });
  it("ignores client-supplied calories/macros (recomputed server-side)", () => {
    const r = savePlanBodySchema.safeParse({ ...body, calories: 1, proteinG: 9999, bmi: 3 });
    expect(r.success).toBe(true);
    if (r.success) expect("calories" in r.data).toBe(false);
  });
  it("rejects invalid mealTime, too many meals and oversized names", () => {
    expect(savePlanBodySchema.safeParse({ ...body, meals: [{ foodId: "x", mealTime: "brunch" }] }).success).toBe(false);
    expect(savePlanBodySchema.safeParse({ ...body, meals: Array.from({ length: 21 }, () => body.meals[0]) }).success).toBe(false);
    expect(savePlanBodySchema.safeParse({ ...body, name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("registerSchema / loginSchema", () => {
  it("normalises e-mail to lower case and trims name", () => {
    const r = registerSchema.safeParse({ name: "  Sam  ", email: "Sam@Example.COM", password: "longenough" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("sam@example.com");
      expect(r.data.name).toBe("Sam");
    }
  });
  it("enforces an 8–72 character password", () => {
    expect(registerSchema.safeParse({ name: "a", email: "a@b.co", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "a", email: "a@b.co", password: "x".repeat(73) }).success).toBe(false);
  });
  it("rejects malformed e-mails", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
});

describe("resultsParamsSchema", () => {
  it("parses a URLSearchParams object", () => {
    const sp = new URLSearchParams({ ...validProfile, allergies: "Nuts", bmi: "25.2", planId: "", fromSaved: "" });
    const r = resultsParamsSchema.safeParse(searchParamsToObject(sp));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bmi).toBe(25.2);
      expect(r.data.planId).toBeUndefined();
      expect(r.data.allergies).toEqual(["Nuts"]);
    }
  });
  it("fails when the profile is incomplete", () => {
    const sp = new URLSearchParams({ age: "30" });
    expect(resultsParamsSchema.safeParse(searchParamsToObject(sp)).success).toBe(false);
  });
});
