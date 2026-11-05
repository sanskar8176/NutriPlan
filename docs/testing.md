# NutriPlan — Testing

## 1. Automated

```bash
npm run check          # lint + typecheck + unit/route tests (what CI runs)
npm test               # Vitest only
npm run test:watch
```

| File | Covers |
|------|--------|
| `tests/calculations.test.ts` | BMR (Mifflin-St Jeor), TDEE multipliers, goal adjustment incl. 1200 kcal floor, macro split, unit conversions |
| `tests/api-schemas.test.ts` | Query/body schemas: coercion, defaults, enum/bounds rejection, client-supplied macros stripped, e-mail normalisation, password policy, results-page URL parsing |
| `tests/allergens.test.ts` | Keyword expansion (Nuts → almond…), hidden-ingredient matches (ghee, paneer, semolina), description matching, no-op when empty |
| `tests/food-data.test.ts` | Static catalogue: complete plan per diet, no duplicates across slots, allergen exclusion, seed variety, image hosts |
| `tests/meal-plan-utils.test.ts` | Slot back-fill without duplicates, plan completeness, allergen exception phrases (plant milks, peanut butter, eggplant) applied per allergy |
| `tests/images-and-utils.test.ts` | Image host allow-list and fallbacks; open-redirect guard |
| `tests/rate-limit.test.ts` | Fixed-window limiter semantics; client IP extraction |
| `tests/prisma-config.test.ts` | DB URL parsing, `sslmode` handling, TLS verification defaults, CA / opt-out env |
| `tests/routes.test.ts` | Route handlers with `auth()`, the DAL and the AI service mocked: 401s, ownership → 404, validation → 400 with issues, malformed JSON → 400, masked 500s, rate limiting → 429 + `Retry-After`, registration hashing/normalisation/409 |

CI (`.github/workflows/ci.yml`) runs the same plus `npm audit --audit-level=high` and a production build on every push and pull request.

## 2. Manual end-to-end checklist (last run 2026-11-05, local production build + Docker PostgreSQL 16)

Setup: `docker run … postgres:16-alpine` (see README), `npm run db:deploy`, `npm run build`, `npm start`.

| # | Check | Result |
|---|-------|--------|
| 1 | Landing page renders, hero animation loads, no console errors except the expected Vercel Analytics 404 outside Vercel | ✔ |
| 2 | Security headers on every response; `X-Powered-By` absent; API `Cache-Control: private, no-store` | ✔ |
| 3 | `POST /api/auth/register`: malformed JSON → 400, weak password → 400, bad e-mail → 400, success → 201, duplicate (different case) → 409, 6th attempt → 429 | ✔ |
| 4 | Sign in with a crafted `callbackUrl=https://evil.example/phish` → lands on `/dashboard` | ✔ |
| 5 | `/plan` step 1 live BMI; step 3 with the weekly-rate field left blank → proceeds (previously blocked) | ✔ |
| 6 | Generate (vegetarian, Nuts excluded) → results with macros, BMI, donut, meals; source line shown; no nut-containing items | ✔ |
| 7 | Save Plan → "Plan saved"; DB row has server-computed calories/bmr/tdee/bmi; static items materialised into `Food` | ✔ |
| 8 | Dashboard lists the plan; View Plan reloads meals via `planId` with "already in your dashboard" | ✔ |
| 9 | Second account: read/delete first account's plan → 404; own list empty; forged `userId`/`calories` ignored; unknown `foodId` → 400 | ✔ |
| 10 | 10 wrong passwords from one IP → correct password refused from that IP, accepted from another | ✔ |
| 11 | `GET /api/meal-plan` with missing/invalid params → 400 with field issues; 13th generation from one IP → 429 | ✔ |
| 12 | Provider chain: with Ollama unreachable and Gemini returning 503, the response still arrives (`source: "static"` when the DB is empty) | ✔ |
| 13 | `POST /api/plan` metric + imperial payloads → 200 with nutrition, BMI and meals | ✔ |
| 14 | Delete plan: confirmation dialog, card removed, request checked | ✔ (see note) |

Note on 14: browser automation cannot interact with the native `confirm()` dialog; the API path (`DELETE` → 200, then 404) was verified directly.

## 3. Testing the AI path locally

1. Put a `GEMINI_API_KEY` in `.env.local` (free at Google AI Studio) and leave `LOCAL_MODEL_NAME` empty.
2. `npm run dev`, open `/plan`, generate. The dev console prints the prompt, the raw model JSON, USDA matches and Unsplash hits (`[NutriPlan:…]` lines).
3. To test the local-model branch: `ollama serve && ollama pull llama3.2`, set `LOCAL_MODEL_NAME=llama3.2`.
4. To test the fallbacks: remove both keys (DB fallback), then stop Postgres (static fallback). The results page states which source was used.

## 4. Suggested next steps

- Playwright suite for the checklist above, run in CI against a Postgres service container.
- Contract tests for the Gemini response schema using recorded fixtures (so prompt changes are reviewed against real outputs).
