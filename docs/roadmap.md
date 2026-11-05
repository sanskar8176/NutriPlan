# NutriPlan — Suggested Enhancements

Ordered by value / effort. None of these are required for the app to run.

## Product
1. **Weekly plans & shopping list** — generate 7 days with no repeated dishes, aggregate ingredients.
2. **Meal swap** — "Replace this meal" button that re-asks the model for one slot while keeping the others.
3. **Progress tracking** — weight log per user, chart against the goal rate; re-run macros as weight changes.
4. **Portion scaling** — scale a saved plan's servings to hit the calorie target exactly (the model's totals are approximate).
5. **Profile persistence** — remember the last profile for signed-in users so `/plan` is pre-filled.
6. **Localisation** — Hindi UI strings; regional cuisine preference (South/North/East/West India) in the prompt.
7. **Accessibility pass** — keyboard focus order on the step buttons, `aria-pressed` on toggle groups, reduced-motion variant of the hero animation.

## Engineering
1. **Shared rate-limit store** (Upstash/Vercel KV) so limits are exact across serverless instances.
2. **Nonce-based CSP** via `proxy.ts` to drop `'unsafe-inline'` from `script-src` (requires dynamic rendering of every page).
3. **E-mail verification & password reset** (Resend/Postmark + Auth.js e-mail provider); currently accounts are live immediately.
4. **Playwright E2E suite** for the sign-up → generate → save → reopen → delete journey (the manual checklist in `testing.md`), run in CI against Docker Postgres.
5. **Background food enrichment** — queue USDA/Unsplash lookups instead of doing them inline, so generation latency depends only on the model.
6. **Structured logging + tracing** (OpenTelemetry → Vercel/Datadog) with request ids in error responses.
7. **`/api/health`** endpoint and an uptime monitor.
8. **Prisma Accelerate or connection pooling tuning** if traffic grows beyond the Supabase transaction pooler's comfort zone.
9. **Move to `src/`** only if the root gets crowded; the current layout is standard for App Router projects.
