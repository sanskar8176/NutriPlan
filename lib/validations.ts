import { z } from "zod";

export const step1Schema = z.object({
  age: z.coerce.number().int().min(10, "Age must be at least 10").max(100, "Age must be at most 100"),
  gender: z.enum(["male", "female", "other"]),
  unit: z.enum(["metric", "imperial"]),
  heightCm: z.coerce.number().optional(),
  heightFt: z.coerce.number().optional(),
  heightIn: z.coerce.number().optional(),
  weightKg: z.coerce.number().optional(),
  weightLbs: z.coerce.number().optional(),
}).superRefine((d, ctx) => {
  if (d.unit === "metric") {
    if (!d.heightCm || d.heightCm < 100 || d.heightCm > 250) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Height must be between 100–250 cm", path: ["heightCm"] });
    }
    if (!d.weightKg || d.weightKg < 30 || d.weightKg > 300) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Weight must be between 30–300 kg", path: ["weightKg"] });
    }
  } else {
    if (!d.heightFt || d.heightFt < 3 || d.heightFt > 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Height feet must be between 3–8", path: ["heightFt"] });
    }
    if (d.heightIn === undefined || d.heightIn < 0 || d.heightIn > 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inches must be between 0–11", path: ["heightIn"] });
    }
    if (!d.weightLbs || d.weightLbs < 66 || d.weightLbs > 660) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Weight must be between 66–660 lbs", path: ["weightLbs"] });
    }
  }
});

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
