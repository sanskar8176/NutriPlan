export type Gender = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type DietType = "non_veg" | "vegetarian" | "vegan" | "eggetarian" | "keto";

export interface UserStats {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetRateKg?: number; // kg/week for lose or gain
}

export interface MacroResult {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor BMR (kcal/day) */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male") return Math.round(base + 5);
  if (gender === "female") return Math.round(base - 161);
  // "other" — average of male/female
  return Math.round(base - 78);
}

/** TDEE = BMR × activity multiplier */
export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

/** Adjust TDEE for goal; default rate 0.5 kg/week */
export function adjustForGoal(tdee: number, goal: Goal, rateKg = 0.5): number {
  const kcalPerKg = 7700; // ~7700 kcal per kg body mass
  const weeklyDelta = Math.round((rateKg * kcalPerKg) / 7);
  if (goal === "lose") return Math.max(1200, tdee - weeklyDelta);
  if (goal === "gain") return tdee + weeklyDelta;
  return tdee;
}

/**
 * Macro split (grams) based on goal and body weight.
 * Protein: 2.0g/kg (gain/lose) or 1.6g/kg (maintain)
 * Fat: 25% of calories
 * Carbs: remainder
 */
export function calculateMacros(
  calories: number,
  weightKg: number,
  goal: Goal
): Pick<MacroResult, "proteinG" | "carbsG" | "fatG"> {
  const proteinPerKg = goal === "maintain" ? 1.6 : 2.0;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);
  return { proteinG, carbsG: Math.max(0, carbsG), fatG };
}

/** Main entry point — returns full macro breakdown */
export function computeNutritionPlan(stats: UserStats): MacroResult {
  const bmr = calculateBMR(
    stats.weightKg,
    stats.heightCm,
    stats.age,
    stats.gender
  );
  const tdee = calculateTDEE(bmr, stats.activityLevel);
  const calories = adjustForGoal(tdee, stats.goal, stats.targetRateKg ?? 0.5);
  const macros = calculateMacros(calories, stats.weightKg, stats.goal);
  return { calories, bmr, tdee, ...macros };
}

// Unit conversion helpers
export const lbsToKg = (lbs: number) => Math.round(lbs * 0.453592 * 10) / 10;
export const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
export const inchesToCm = (inches: number) => Math.round(inches * 2.54);
export const cmToInches = (cm: number) => Math.round(cm / 2.54);
export const ftInToCm = (ft: number, inches: number) =>
  Math.round((ft * 12 + inches) * 2.54);

/** BMI = weight(kg) / height(m)² */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!heightCm || !weightKg) return 0;
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

export type BMICategory = "Underweight" | "Normal" | "Overweight" | "Obese";

export function getBMICategory(bmi: number): { category: BMICategory; color: string } {
  if (bmi < 18.5) return { category: "Underweight", color: "text-blue-500" };
  if (bmi < 25)   return { category: "Normal",      color: "text-green-500" };
  if (bmi < 30)   return { category: "Overweight",  color: "text-amber-500" };
  return             { category: "Obese",         color: "text-red-500" };
}
