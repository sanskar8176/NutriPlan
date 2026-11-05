# NutriPlan — API Reference

Base URL: `https://nutri-plan-ruddy.vercel.app` (production) or `http://localhost:3000` (dev).

- All bodies and responses are JSON.
- Authenticated routes use the Auth.js session cookie (`authjs.session-token`, HttpOnly). Browser clients get it automatically after `signIn()`.
- Errors always have the shape `{ "error": string, "issues"?: [{ "path": string, "message": string }] }`.
- Every `/api/*` response carries `Cache-Control: private, no-store`.
- Rate-limited routes answer `429` with a `Retry-After` header (seconds).

## Shared enums

| Field | Values |
|-------|--------|
| `gender` | `male` · `female` · `other` |
| `activityLevel` | `sedentary` · `light` · `moderate` · `active` · `very_active` |
| `goal` | `lose` · `maintain` · `gain` |
| `dietType` | `non_veg` · `vegetarian` · `vegan` · `eggetarian` · `keto` |
| `mealTime` | `breakfast` · `lunch` · `dinner` · `snack` |

Profile bounds: `age` 10–100 (integer), `heightCm` 100–250, `weightKg` 30–300, `targetRateKg` 0.1–1.0 (optional, default 0.5), `allergies` ≤ 20 strings of ≤ 40 chars.

---

## `GET /api/meal-plan` — generate a meal plan

**Auth:** none · **Rate limit:** 12 requests / 10 min per IP

Query parameters: the profile fields above plus `allergies` (comma-separated, e.g. `Nuts,Dairy`) and `seed` (integer 0–1 000 000, default 0; change it to get a different plan).

```
GET /api/meal-plan?age=30&gender=female&heightCm=165&weightKg=60&activityLevel=moderate&goal=lose&dietType=vegan&allergies=Nuts,Dairy&seed=3
```

Response `200`:
```json
{
  "meals": {
    "breakfast": [ { "id": "cmw…", "name": "Poha with Peanuts", "description": "…", "calories": 320, "proteinG": 8, "carbsG": 52, "fatG": 9, "mealTime": ["breakfast"], "dietTags": ["vegetarian","vegan","non_veg"], "image": "https://images.unsplash.com/…", "servingSize": "1 bowl (200g)", "aiGenerated": true } ],
    "lunch": [ … ], "dinner": [ … ], "snack": [ …, … ]
  },
  "source": "gemini",
  "saved": false
}
```
`source` ∈ `gemini` · `local` · `database` · `static` — which stage of the fallback chain produced the plan.

Errors: `400` invalid/missing profile (with `issues`), `429` rate limited, `500` unexpected (message never includes internals).

## `GET /api/meal-plan?planId=…` — meals of a saved plan

**Auth:** required, must own the plan · **Rate limit:** 120 / min per IP

```
GET /api/meal-plan?planId=cmw36bixe000698lpppawpk6k
```
Response `200`: same shape as above with `"source": "database", "saved": true`.

Errors: `401` not signed in, `404` plan does not exist **or belongs to another user** (indistinguishable by design), `400` malformed id.

---

## `POST /api/plan` — stateless calculator

**Auth:** none · no AI, no database. Useful for integrations and smoke tests.

Body: the raw form payload (either unit system).
```json
{ "age": 30, "gender": "male", "unit": "metric", "heightCm": 178, "weightKg": 80,
  "activityLevel": "moderate", "goal": "lose", "targetRateKg": 0.5,
  "dietType": "vegetarian", "allergies": ["Nuts"] }
```
Imperial: `"unit": "imperial", "heightFt": 5, "heightIn": 10, "weightLbs": 176`.

Response `200`:
```json
{ "nutrition": { "calories": 2190, "bmr": 1768, "tdee": 2740, "proteinG": 160, "carbsG": 250, "fatG": 61 },
  "bmi": 25.2,
  "meals": { "breakfast": [ … ], "lunch": [ … ], "dinner": [ … ], "snack": [ … ] } }
```
Errors: `400` malformed JSON or validation (`issues`), `500`.

---

## `GET /api/plans` — list my saved plans

**Auth:** required.

Response `200`: `PlanDTO[]` ordered newest first.
```json
[ { "id": "cmw…", "name": "Weight Loss Plan", "createdAt": "2026-11-05T06:34:12.000Z",
    "age": 32, "gender": "female", "heightCm": 165, "weightKg": 68, "activityLevel": "active",
    "goal": "lose", "targetRateKg": 0.5, "dietType": "vegetarian", "allergies": ["nuts"],
    "calories": 1848, "proteinG": 136, "carbsG": 211, "fatG": 51, "bmr": 1390, "tdee": 2398, "bmi": 25 } ]
```

## `POST /api/plans` — save a plan

**Auth:** required · **Rate limit:** 30 / 15 min per user

Body:
```json
{ "name": "Weight Loss Plan",
  "age": 32, "gender": "female", "heightCm": 165, "weightKg": 68,
  "activityLevel": "active", "goal": "lose", "targetRateKg": 0.5,
  "dietType": "vegetarian", "allergies": ["Nuts"],
  "meals": [ { "foodId": "cmw…", "mealTime": "breakfast", "position": 0, "aiGenerated": true } ] }
```
- `meals` ≤ 20 items. `foodId` must be an existing `Food.id` or an id from the bundled catalogue (which is materialised on first save).
- `calories`, `proteinG`, `carbsG`, `fatG`, `bmr`, `tdee`, `bmi`, `userId` in the body are **ignored**; they are recomputed from the profile on the server.

Response `201`: the created `PlanDTO`.

Errors: `400` malformed JSON / validation / unknown `foodId` ("One or more meals no longer exist…"), `401`, `413` body > 64 KB, `429`, `500`.

## `DELETE /api/plans/:id` — delete my plan

**Auth:** required, must own the plan.

Response `200`: `{ "ok": true }`.
Errors: `401`, `404` (missing or not yours), `400` malformed id.

---

## `POST /api/auth/register` — create a credentials account

**Auth:** none · **Rate limit:** 5 / 15 min per IP

Body: `{ "name": "Sam", "email": "sam@example.com", "password": "at-least-8-chars" }`
- E-mail is trimmed and lower-cased (so `Sam@Example.com` and `sam@example.com` are the same account).
- Password 8–72 characters (bcrypt limit), stored as a bcrypt hash (cost 12).

Response `201`: `{ "ok": true }`.
Errors: `400` malformed JSON / validation (message explains which rule), `409` e-mail already registered, `429`, `500`.

## Auth.js routes (`/api/auth/*`)

Provided by Auth.js v5. The ones a client uses:

| Route | Purpose |
|-------|---------|
| `GET /api/auth/providers` | Which providers are enabled (`credentials`, and `google` when configured) |
| `GET /api/auth/csrf` | CSRF token required by the credentials callback |
| `POST /api/auth/callback/credentials` | Sign in with e-mail + password (`csrfToken`, `email`, `password`; add `json=true` for a JSON response). 10 attempts / 15 min per IP; a limited or failed attempt redirects to `/auth/signin?error=CredentialsSignin`. |
| `GET /api/auth/signin/google` → `GET /api/auth/callback/google` | Google OAuth flow |
| `GET /api/auth/session` | Current session (`{ user: { id, name, email, image }, expires }` or `null`) |
| `POST /api/auth/signout` | Sign out |

The sign-in page only honours a `callbackUrl` that is a same-origin path (`/dashboard`, `/results?…`); absolute or protocol-relative URLs fall back to `/dashboard`.
