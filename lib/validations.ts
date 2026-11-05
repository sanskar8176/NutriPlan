// Multi-step plan form schemas (client) + the combined input accepted by POST /api/plan.
import { z } from "zod";
import { genderSchema, activitySchema, goalSchema, dietTypeSchema, allergiesSchema } from "@/lib/api-schemas";

/** Number inputs submit "" when empty; treat that as "not provided" instead of 0. */
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : v),
  z.coerce.number().optional(),
);

export const step1Schema = z.object({
  age:       z.coerce.number().int("Age must be a whole number").min(10, "Age must be at least 10").max(100, "Age must be at most 100"),
  gender:    genderSchema,
  unit:      z.enum(["metric", "imperial"]),
  heightCm:  optionalNumber,
  heightFt:  optionalNumber,
  heightIn:  optionalNumber,
  weightKg:  optionalNumber,
  weightLbs: optionalNumber,
}).superRefine((d, ctx) => {
  if (d.unit === "metric") {
    if (!d.heightCm || d.heightCm < 100 || d.heightCm > 250) {
      ctx.addIssue({ code: "custom", message: "Height must be between 100–250 cm", path: ["heightCm"] });
    }
    if (!d.weightKg || d.weightKg < 30 || d.weightKg > 300) {
      ctx.addIssue({ code: "custom", message: "Weight must be between 30–300 kg", path: ["weightKg"] });
    }
  } else {
    if (!d.heightFt || d.heightFt < 3 || d.heightFt > 8) {
      ctx.addIssue({ code: "custom", message: "Height feet must be between 3–8", path: ["heightFt"] });
    }
    if (d.heightIn === undefined || d.heightIn < 0 || d.heightIn > 11) {
      ctx.addIssue({ code: "custom", message: "Inches must be between 0–11", path: ["heightIn"] });
    }
    if (!d.weightLbs || d.weightLbs < 66 || d.weightLbs > 660) {
      ctx.addIssue({ code: "custom", message: "Weight must be between 66–660 lbs", path: ["weightLbs"] });
    }
  }
});

export const step2Schema = z.object({
  activityLevel: activitySchema,
});

export const step3Schema = z.object({
  goal: goalSchema,
  targetRateKg: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0.1, "Rate must be at least 0.1 kg/week").max(1.0, "Rate must be at most 1.0 kg/week").optional(),
  ),
});

export const step4Schema = z.object({
  dietType:  dietTypeSchema,
  allergies: allergiesSchema,
});

export const planInputSchema = step1Schema.and(step2Schema).and(step3Schema).and(step4Schema);

// Output (validated) types …
export type Step1Data = z.output<typeof step1Schema>;
export type Step2Data = z.output<typeof step2Schema>;
export type Step3Data = z.output<typeof step3Schema>;
export type Step4Data = z.output<typeof step4Schema>;
export type PlanInput = z.output<typeof planInputSchema>;
// … and raw form-input types (what react-hook-form holds before coercion).
export type Step1Input = z.input<typeof step1Schema>;
export type Step2Input = z.input<typeof step2Schema>;
export type Step3Input = z.input<typeof step3Schema>;
export type Step4Input = z.input<typeof step4Schema>;
