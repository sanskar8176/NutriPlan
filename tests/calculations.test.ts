import {
  calculateBMR,
  calculateTDEE,
  adjustForGoal,
  calculateMacros,
  computeNutritionPlan,
  lbsToKg,
  ftInToCm,
} from "@/lib/calculations";

describe("calculateBMR", () => {
  it("returns correct BMR for a male", () => {
    // 30yo male, 80kg, 180cm → 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(calculateBMR(80, 180, 30, "male")).toBe(1780);
  });

  it("returns correct BMR for a female", () => {
    // 25yo female, 60kg, 165cm → 10*60 + 6.25*165 - 5*25 - 161 = 1345
    expect(calculateBMR(60, 165, 25, "female")).toBe(1345);
  });

  it("returns average BMR for other gender", () => {
    const male = calculateBMR(70, 170, 28, "male");
    const female = calculateBMR(70, 170, 28, "female");
    const other = calculateBMR(70, 170, 28, "other");
    expect(other).toBeGreaterThanOrEqual(female);
    expect(other).toBeLessThanOrEqual(male);
  });

  it("decreases BMR with age", () => {
    const young = calculateBMR(75, 175, 25, "male");
    const old = calculateBMR(75, 175, 50, "male");
    expect(young).toBeGreaterThan(old);
  });
});

describe("calculateTDEE", () => {
  it("multiplies BMR by sedentary factor (1.2)", () => {
    expect(calculateTDEE(1800, "sedentary")).toBe(2160);
  });

  it("multiplies BMR by very_active factor (1.9)", () => {
    expect(calculateTDEE(1800, "very_active")).toBe(3420);
  });
});

describe("adjustForGoal", () => {
  it("reduces calories for weight loss", () => {
    expect(adjustForGoal(2500, "lose", 0.5)).toBeLessThan(2500);
  });

  it("increases calories for muscle gain", () => {
    expect(adjustForGoal(2500, "gain", 0.5)).toBeGreaterThan(2500);
  });

  it("returns TDEE unchanged for maintain", () => {
    expect(adjustForGoal(2500, "maintain")).toBe(2500);
  });

  it("never drops below 1200 kcal", () => {
    expect(adjustForGoal(1300, "lose", 2.0)).toBeGreaterThanOrEqual(1200);
  });
});

describe("calculateMacros", () => {
  it("protein is higher for gain goal", () => {
    const gain = calculateMacros(2500, 80, "gain");
    const maintain = calculateMacros(2500, 80, "maintain");
    expect(gain.proteinG).toBeGreaterThan(maintain.proteinG);
  });

  it("carbs are never negative", () => {
    const result = calculateMacros(1200, 100, "gain");
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
  });

  it("macro calories roughly equal total calories (±50 kcal rounding)", () => {
    const { proteinG, carbsG, fatG } = calculateMacros(2000, 75, "maintain");
    const total = proteinG * 4 + carbsG * 4 + fatG * 9;
    expect(Math.abs(total - 2000)).toBeLessThan(50);
  });
});

describe("computeNutritionPlan", () => {
  it("returns a complete plan with all fields", () => {
    const result = computeNutritionPlan({
      age: 30,
      gender: "male",
      heightCm: 178,
      weightKg: 80,
      activityLevel: "moderate",
      goal: "lose",
    });
    expect(result).toHaveProperty("calories");
    expect(result).toHaveProperty("bmr");
    expect(result).toHaveProperty("tdee");
    expect(result).toHaveProperty("proteinG");
    expect(result).toHaveProperty("carbsG");
    expect(result).toHaveProperty("fatG");
    expect(result.calories).toBeGreaterThan(0);
    expect(result.tdee).toBeGreaterThan(result.bmr);
  });
});

describe("unit conversions", () => {
  it("converts 154 lbs to ~70 kg", () => {
    expect(lbsToKg(154)).toBeCloseTo(69.9, 0);
  });

  it("converts 5ft 10in to 178 cm", () => {
    expect(ftInToCm(5, 10)).toBe(178);
  });
});
