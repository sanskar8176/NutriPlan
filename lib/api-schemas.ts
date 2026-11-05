// Zod schemas for every API boundary. Shared between route handlers (server)
// and the results page (client) so URL parameters and request bodies are
// validated with one definition.
import { z } from "zod";

export const GENDERS        = ["male", "female", "other"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const GOALS          = ["lose", "maintain", "gain"] as const;
export const DIET_TYPES     = ["non_veg", "vegetarian", "vegan", "eggetarian", "keto"] as const;
export const MEAL_TIMES     = ["breakfast", "lunch", "dinner", "snack"] as const;

export const genderSchema   = z.enum(GENDERS);
export const activitySchema = z.enum(ACTIVITY_LEVELS);
export const goalSchema     = z.enum(GOALS);
export const dietTypeSchema = z.enum(DIET_TYPES);
export const mealTimeSchema = z.enum(MEAL_TIMES);

/** Treats "", null and undefined as "not provided" so optional numeric query/form fields validate cleanly. */
const emptyToUndefined = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

export const allergiesSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([]);

/** Comma separated allergies as sent in query strings ("Nuts,Dairy"). */
export const allergiesQuerySchema = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v ?? []),
  allergiesSchema,
);

/** The physical profile every calculation and every AI prompt is based on. */
export const profileSchema = z.object({
  age:           z.coerce.number().int().min(10).max(100),
  gender:        genderSchema,
  heightCm:      z.coerce.number().min(100).max(250),
  weightKg:      z.coerce.number().min(30).max(300),
  activityLevel: activitySchema,
  goal:          goalSchema,
  targetRateKg:  z.preprocess(emptyToUndefined, z.coerce.number().min(0.1).max(1).optional()),
  dietType:      dietTypeSchema,
});

export type Profile = z.infer<typeof profileSchema>;

/** GET /api/meal-plan (fresh generation) query parameters. */
export const mealPlanQuerySchema = profileSchema.extend({
  allergies: allergiesQuerySchema,
  seed:      z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1_000_000).default(0)),
});
export type MealPlanQuery = z.infer<typeof mealPlanQuerySchema>;

/** Query parameters the results page accepts (either a saved planId or a full profile). */
export const resultsParamsSchema = profileSchema.extend({
  allergies: allergiesQuerySchema,
  bmi:       z.preprocess(emptyToUndefined, z.coerce.number().min(5).max(100).optional()),
  planId:    z.preprocess(emptyToUndefined, z.string().min(1).max(64).optional()),
  fromSaved: z.preprocess(emptyToUndefined, z.string().optional()),
});
export type ResultsParams = z.infer<typeof resultsParamsSchema>;

/** One meal slot in a saved plan. */
export const savedMealSchema = z.object({
  foodId:      z.string().trim().min(1).max(64),
  mealTime:    mealTimeSchema,
  position:    z.coerce.number().int().min(0).max(50).default(0),
  aiGenerated: z.boolean().default(false),
});

/** POST /api/plans body. Calories / macros / BMI are recomputed on the server and never trusted from the client. */
export const savePlanBodySchema = profileSchema.extend({
  name:      z.string().trim().min(1).max(100).default("My Plan"),
  allergies: allergiesSchema,
  meals:     z.array(savedMealSchema).max(20).default([]),
});
export type SavePlanBody = z.infer<typeof savePlanBodySchema>;

const emailSchema = z.email().max(254).transform((e) => e.trim().toLowerCase());

/** POST /api/auth/register body. bcrypt only hashes the first 72 bytes, hence the upper bound. */
export const registerSchema = z.object({
  name:     z.string().trim().min(1).max(100),
  email:    emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
export type RegisterBody = z.infer<typeof registerSchema>;

/** Credentials provider input. */
export const loginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1).max(72),
});

/** Converts a URLSearchParams / FormData style object into a plain record for zod. */
export function searchParamsToObject(sp: { entries(): IterableIterator<[string, string]> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) if (!(k in out)) out[k] = v;
  return out;
}
