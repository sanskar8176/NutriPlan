import { z } from "zod";

export const step1Schema = z.object({
  age: z.coerce.number().int().min(10, "Age must be at least 10").max(100, "Age must be at most 100"),
  gender: z.enum(["male", "female", "other"]),
  unit: z.enum(["metric", "imperial"]),
  heightCm: z.coerce.number().min(100, "Height must be at least 100cm").max(250, "Height must be at most 250cm").optional(),
  heightFt: z.coerce.number().min(3).max(8).optional(),
  heightIn: z.coerce.number().min(0).max(11).optional(),
  weightKg: z.coerce.number().min(30, "Weight must be at least 30kg").max(300, "Weight must be at most 300kg").optional(),
  weightLbs: z.coerce.number().min(66, "Weight must be at least 66lbs").max(660, "Weight must be at most 660lbs").optional(),
}).refine(
  (d) => d.unit === "metric" ? !!d.heightCm && !!d.weightKg : !!d.heightFt && !!d.weightLbs,
  { message: "Please fill in all height and weight fields" }
);

export const step2Schema = z.object({
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
});

export const step3Schema = z.object({
  goal: z.enum(["lose", "maintain", "gain"]),
  targetRateKg: z.coerce.number().min(0.1).max(1.0).optional(),
});

export const step4Schema = z.object({
  dietType: z.enum(["non_veg", "vegetarian", "vegan", "eggetarian", "keto"]),
  allergies: z.array(z.string()).default([]),
});

export const planInputSchema = step1Schema.and(step2Schema).and(step3Schema).and(step4Schema);

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type PlanInput = z.infer<typeof planInputSchema>;
