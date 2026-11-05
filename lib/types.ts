// Client-safe shared types (no server imports).
import type { FoodItem, MealTime } from "@/lib/food-data";

/** Where a meal plan came from, in order of preference. */
export type MealPlanSource = "local" | "gemini" | "database" | "static";

export type MealsByTime = Record<MealTime, FoodItem[]>;

/** Response body of GET /api/meal-plan. */
export interface MealPlanResponse {
  meals: MealsByTime;
  source: MealPlanSource;
  /** True when meals were loaded from a saved plan instead of generated. */
  saved: boolean;
}

/** Plan DTO returned by /api/plans (no userId, no internal fields). */
export interface PlanDTO {
  id: string;
  name: string;
  createdAt: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
  targetRateKg: number | null;
  dietType: string;
  allergies: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  bmi: number | null;
}
