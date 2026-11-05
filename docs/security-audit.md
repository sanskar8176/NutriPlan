# NutriPlan — Security Audit (2026-11-05)

Scope: full source review of the repository at commit `efd24e1`, dependency audit, configuration review, and live probing of the production deployment (`nutri-plan-ruddy.vercel.app`) and of a local production build against a Docker PostgreSQL. Every finding below has been fixed in this change set unless marked *residual*.

Severity scale: **Critical** (direct compromise / data loss), **High** (data exposure or abuse with low effort), **Medium** (weakens defences), **Low** (hardening / hygiene).

## 1. Findings and fixes

### Secrets & repository hygiene

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| S1 | **Critical** | `.env.example` contained a real Supabase database password in a commented-out `DATABASE_URL`. It was not in git history only because `.gitignore` ignored `.env*` — which also meant the template itself was never committed. | Scrubbed; `.env.example` rewritten as a documented template and un-ignored (`!.env.example`). **Rotate the Supabase database password** anyway, since the value lived on disk and may have been shared. |
| S2 | **High** | `dev-output.log` (2 400 lines of dev-server output with absolute paths and stack traces) was committed. | Removed from git; `*.log` ignored. |
| S3 | Low | Stray screenshots in the repo root; `Notes.txt` and `lib/prisma-types.ts` dead files. | Moved screenshots to `docs/screenshots/`, removed dead files, content folded into docs. |

### Authorisation & data access

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| A1 | **High** | **IDOR** — `GET /api/meal-plan?planId=…` had no authentication at all. Anyone who guessed or obtained a plan id could read another user's saved meals (dietary/health data). | Route now requires a session and loads through `getSavedPlanMeals(planId, userId)`, which filters by owner; foreign ids return 404. Verified live: attacker account → 404. |
| A2 | Medium | `DELETE /api/plans/:id` did a find-then-delete (TOCTOU) and leaked existence via different code paths. | Single scoped `deleteMany({ id, userId })`; missing and foreign plans are indistinguishable (404). |
| A3 | Medium | `POST /api/plans` trusted client-supplied `calories`, `proteinG`, `bmr`, `tdee`, `bmi` and free-text enums (`gender`, `goal`, `dietType`, `mealTime`), and accepted an unbounded `meals` array → garbage data and DB flooding. | Strict zod schema (enums, bounds, ≤ 20 meals, ≤ 64 KB body). All derived values are recomputed on the server (`lib/plans.ts`). Unknown keys (e.g. a forged `userId`) are stripped. Verified live: forged `userId`/`calories` ignored. |
| A4 | Medium | `POST /api/plans` accepted arbitrary `foodId`s; a static-catalogue id caused a foreign-key violation → unhandled 500. | Ids are resolved; static items are materialised into `Food`; unknown ids → 400 with a clear message. |
| A5 | Low | Dashboard passed raw Prisma rows (incl. `userId`) to the client component. | DTO (`PlanDTO`) without internal fields. |

### Input validation & abuse

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| V1 | **High** | `GET /api/meal-plan` (fresh generation) accepted unvalidated input and was **unauthenticated and unlimited** while triggering paid third-party calls (Gemini, USDA, Unsplash) and DB writes per request → cost/quota exhaustion and `Food` table pollution. | zod validation of every parameter (bounded numbers, enums, ≤ 20 allergies, seed ≤ 1e6). Rate limit 12/10 min per IP for generation, 120/min for saved-plan loads. Model output validated with zod before persistence. |
| V2 | Medium | Registration/sign-in had no rate limiting → credential stuffing and account-spam. | 5 registrations / 15 min per IP; 10 sign-in attempts / 15 min per IP inside `authorize()`. Verified live: 6th registration → 429; correct password refused after 10 failures from the same IP, accepted from another. |
| V3 | Medium | Password policy `min(6)`, no upper bound (bcrypt silently truncates at 72 bytes). | 8–72 characters, enforced server-side and in the form. |
| V4 | Medium | E-mail not normalised → `A@x.com` and `a@x.com` were different accounts; sign-in could miss. | Trimmed + lower-cased in one shared schema used by register and authorize. |
| V5 | Medium | Malformed JSON bodies → unhandled exceptions → 500 (register, plans). | `readJsonBody()` helper → 400 "Malformed JSON body"; every handler wrapped, errors logged server-side and masked in the response. |
| V6 | Low | Allergies were interpolated into the AI prompt verbatim (prompt-injection surface). | Reduced to plain `[a-z0-9 -]` words, max 20. The model's output is re-checked in code regardless. |

### Authentication

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| AU1 | Medium | **Open redirect** — the sign-in page did `router.push(callbackUrl)` with any value, so `/auth/signin?callbackUrl=https://evil.example` sent users off-site after login (phishing vector). | `safeRedirectPath()` allows only same-origin paths (`/…`, not `//`, not `/\`). Verified live in the browser. |
| AU2 | Medium | Timing side channel in `authorize()`: unknown e-mails returned before bcrypt ran, revealing registered addresses. | Always `bcrypt.compare` against a dummy hash when the user is missing. |
| AU3 | Low | Google provider registered even with empty credentials → confusing errors. | Provider only registered when configured; the button is rendered server-side only in that case. |

### Transport, headers & browser hardening

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| T1 | Medium | `lib/prisma.ts` set `ssl: { rejectUnauthorized: false }` — database TLS **without certificate verification** (MITM-able). The `sslmode` strip regex also produced broken URLs when other params followed. | `buildPoolConfig()` parses the URL, honours `sslmode`, verifies certificates by default, supports `DATABASE_SSL_CA`, and an explicit opt-out env for private CAs. Unit-tested. |
| T2 | Medium | No Content-Security-Policy. | CSP added: `default-src 'self'`, script/style/img/font/connect allow-lists, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action` restricted, `upgrade-insecure-requests`. Verified in the browser with zero violations. (`'unsafe-inline'` remains for Next.js bootstrap scripts; see residual R2.) |
| T3 | Low | `X-Powered-By: Next.js` disclosed; `Permissions-Policy` incomplete; no HSTS from the app itself (Vercel adds one). | `poweredByHeader: false`; HSTS, `X-DNS-Prefetch-Control`, `browsing-topics=()` added. |
| T4 | Low | Google Fonts loaded from `fonts.googleapis.com` at runtime (third-party request per visit, blocks a strict CSP). | Self-hosted via `next/font/google`. |
| T5 | Low | `next/image` allowed `source.unsplash.com` (dead service) and any DB-stored image URL could crash rendering if its host was not allow-listed. | Allow-list reduced to the two Unsplash hosts; `safeImageUrl()` replaces anything else with a category fallback before it reaches `<Image>`. |
| T6 | Low | API keys sent as URL query parameters (Gemini ListModels `?key=`, USDA `?api_key=`) → leak via logs/proxies. | Moved to headers (`x-goog-api-key`, `X-Api-Key`). |
| T7 | Low | API responses had no explicit cache directive. | `Cache-Control: private, no-store` on `/api/*`. |

### Dependencies

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| D1 | **Critical** | `next@16.2.12` had 11 open advisories including unauthenticated RCE in the Image Optimization API and `use cache`. | Upgraded to `next@16.4.5` + matching `eslint-config-next`. |
| D2 | High | `zod@3.25` (memory exhaustion), `undici`, `vite`, `nanoid`, `js-yaml`, `brace-expansion`, `fast-uri`, `deepmerge-ts`, `mysql2` (via Prisma CLI), `postcss`, `sharp` advisories. | `zod@4.6.7` (code migrated), Prisma 7.10.1, `npm audit fix` for the rest. **0 critical / 0 high** remain. |
| D3 | Medium | `@google/generative-ai` is deprecated (EOL Aug 2025, no security fixes). | Migrated to `@google/genai` 2.x with request timeouts. |
| D4 | Low | 8 *moderate* `minimatch` advisories remain inside `eslint-config-next → typescript-eslint` (dev-only, lint tooling, not shipped). | *Residual R3* — resolves when `eslint-config-next` updates its dependency. |

### Reliability bugs found during the audit (fixed)

| # | Finding | Fix |
|---|---------|-----|
| B1 | **Core feature broken in production.** `/api/meal-plan` returned 500 and the results page showed "Could not load meal plan": the Supabase project no longer resolves, and the code's DB fallback itself threw with no further fallback. | Provider chain local → Gemini → DB → static; every stage caught. The database outage still needs fixing (see `deployment.md`). |
| B2 | When `LOCAL_MODEL_NAME` was set (as in the committed example) a dead Ollama caused generation to skip Gemini entirely and go straight to the DB fallback. | Chain tries every configured provider in order; all calls have timeouts. Gemini retries once on 429/503 and falls back to `gemini-2.5-flash` if the configured model is unavailable. |
| B3 | Allergy exclusions barely worked: the DB fallback compared `name IN ('nuts')` literally, the static fallback matched only the category word, and the AI result was never checked. | `lib/allergens.ts` keyword map (Nuts → almond, cashew, peanut…; Dairy → paneer, ghee, curd…; Gluten → roti, semolina…) with per-allergy exceptions (coconut milk, peanut butter, eggplant…) applied to AI output, DB queries and the static catalogue. Slots emptied by the guard-rails are back-filled from the DB/static catalogue so every plan is complete. |
| B4 | Vegan/vegetarian requests could contain meat/dairy if the model ignored the instruction. | `enforceDiet()` drops violating items; prompt tightened. |
| B5 | Step 3 of the form could not be completed when the optional weekly-rate field was left blank (`""` coerced to `0` → `min(0.1)` failed). | Empty → `undefined` preprocessing; bounds and label aligned (0.1–1.0). |
| B6 | Results page cast URL parameters blindly: an unknown `activityLevel` produced `NaN` everywhere and a failing save. | URL validated with the shared schema; invalid → friendly "we need a few details" screen. |
| B7 | Saving a plan generated from the static catalogue always failed (FK violation). | Static items are materialised into `Food` on first save. |
| B8 | Deleting a plan removed it from the UI even when the request failed; no confirmation. | Confirmation dialog, response checked, error surfaced. |
| B9 | Landing page stats were wrong ("4 diet types"; there are 5). The DB-backed preview was prerendered once at build time. | Copy fixed; ISR (1 h). |
| B10 | AI food upsert overwrote `mealTimes`/`dietTags` on every regeneration. | Arrays merged. |
| B11 | No Prisma migrations (schema pushed manually) → no reproducible schema deploys. | `prisma/migrations/0001_init` generated; `vercel-build` runs `prisma migrate deploy`. |

## 2. Verification performed

- `npm run check`: ESLint clean, `tsc` clean, **81 Vitest tests** green (math, schemas, allergens incl. exceptions, plan back-fill, images/redirects, rate limiter, DB config, route handlers with auth/DB mocked).
- Production build (`next build`) succeeds; local production server tested against Docker PostgreSQL 16:
  - Security headers present (CSP, HSTS, XFO, nosniff, referrer, permissions), `X-Powered-By` absent, API `Cache-Control: private, no-store`.
  - Unauthenticated access to `/api/plans`, `/api/plans/:id`, `/api/meal-plan?planId` → 401.
  - IDOR: second account reading/deleting the first account's plan → 404; own list isolated.
  - Mass assignment: forged `userId`/`calories` ignored; unknown `foodId` → 400.
  - Malformed JSON → 400 on every POST route; validation errors → 400 with field issues.
  - Register rate limit → 429 after 5; login limit blocks the correct password after 10 failures from one IP and allows it from another.
  - Open redirect: `callbackUrl=https://evil.example/phish` → landed on `/dashboard`.
  - Browser end-to-end: sign-in → 4-step form (blank rate accepted) → results → save → dashboard → reopen saved plan; zero CSP violations in the console.
- Live production probe confirmed the pre-fix state (unauthenticated `planId` read possible, generation 500 due to DB outage).

## 3. Residual risk & recommendations

| # | Item | Recommendation |
|---|------|----------------|
| R1 | **Production database is down** (Supabase project paused/deleted). Until restored the live site cannot generate from DB or save plans (it now degrades to the static catalogue instead of erroring). | Follow the runbook in `deployment.md` §3; rotate the DB password. |
| R2 | CSP keeps `script-src 'unsafe-inline'` because Next.js injects inline bootstrap scripts without nonces. XSS is still mitigated by React escaping, `object-src 'none'`, `base-uri`, `form-action`, and the image/connect allow-lists. | Move to nonce-based CSP via `proxy.ts` once every page can be rendered dynamically. |
| R3 | 8 moderate dev-only advisories (`minimatch` via `eslint-config-next`). | Upgrade when upstream releases. |
| R4 | Rate limits are per serverless instance. | Upstash/Vercel KV store (one-function swap). |
| R5 | Accounts are usable without e-mail verification; no password reset. | Add Auth.js e-mail provider / Resend. |
| R6 | User enumeration via `409 Email already registered` on sign-up (an accepted UX trade-off; sign-in does not leak). | Keep, or switch to "check your e-mail" flow with verification. |
| R7 | Google OAuth tokens are stored by the Prisma adapter in `Account` (standard). | Keep DB access restricted; consider dropping unused `refresh_token` storage. |
| R8 | `GET /api/meal-plan` generation is public by design (guests can build plans). | If costs become a concern, require sign-in for AI generation or add a CAPTCHA after N requests. |
