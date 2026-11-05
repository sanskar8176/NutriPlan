# NutriPlan — Deployment & Operations

## 1. Pipeline (Vercel + GitHub)

```mermaid
flowchart LR
    DEV[Developer] -->|git push / PR| GH[GitHub<br/>sanskar8176/NutriPlan]
    GH -->|Actions| CI[CI workflow<br/>lint · typecheck · test · audit · build]
    GH -->|Git integration| VB[Vercel build<br/>npm ci → prisma generate → vercel-build]
    VB -->|prisma migrate deploy| DB[(Supabase Postgres)]
    VB -->|next build| ART[Serverless functions + static assets]
    ART -->|branch ≠ main| PREV[Preview deployment<br/>unique URL per commit]
    ART -->|main| PROD[Production<br/>nutri-plan-ruddy.vercel.app]
```

| Stage | Detail |
|-------|--------|
| Trigger | Vercel's GitHub integration (no `vercel.json` build config needed). `main` → Production; any other branch / PR → Preview. The repo's GitHub *Deployments* tab shows both environments (`Production`, `Preview`) with status checks from Vercel. |
| Install | `npm ci`; `postinstall` → `prisma generate` (needed because the generated client is not committed). |
| Build | Vercel prefers the `vercel-build` script when present: **`tsx scripts/db-deploy.ts && next build`**. Migrations run before the build (self-baselining an existing database, see §3.1); a failed migration fails the deployment. |
| Runtime | Node.js serverless functions for pages/route handlers, CDN for static assets, ISR for `/`. |
| Analytics | `@vercel/analytics` (`<Analytics />` in the root layout). The script only loads on Vercel domains. |
| CI | `.github/workflows/ci.yml` runs on every push and PR. Required-check protection on `main` is recommended (GitHub → Settings → Branches). |

**Rollback:** Vercel → Deployments → "Promote to Production" on a previous build. Migrations are additive; if a rollback needs a schema change, write a new migration rather than editing an applied one.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
|----------|----------|-------|
| `AUTH_SECRET` | ✔ | `npx auth secret`. Rotating it signs everyone out. |
| `DATABASE_URL` | ✔ | Supabase **Transaction pooler** URI (port 6543) with `?sslmode=require`. Used by the app at runtime. |
| `DIRECT_URL` | ✔ | Supabase **Session pooler** or direct URI (port 5432). Used by `prisma migrate deploy` during the build and by the seed script. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google". Redirect URI: `https://<domain>/api/auth/callback/google`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional | AI generation. Default model `gemini-2.5-flash`; the app retries on 429/503 and falls back to `gemini-2.5-flash` if a custom model is unavailable. |
| `LOCAL_MODEL_BASE_URL`, `LOCAL_MODEL_NAME` | optional | **Leave unset on Vercel** (there is no local model there), so production goes Gemini → database → static. When both are set (local Ollama) the local model is tried before Gemini. |
| `USDA_API_KEY` | optional | Defaults to `DEMO_KEY` (30 req/h). Get a free key for production. |
| `UNSPLASH_ACCESS_KEY` | optional | Without it, category fallback photos are used. |
| `DATABASE_SSL_CA` / `DATABASE_SSL_REJECT_UNAUTHORIZED` | rarely | TLS verification is on by default. Only use the escape hatch for providers with private CAs. |

`AUTH_URL` is **not** needed on Vercel (`VERCEL` env makes Auth.js trust the host). Set it only for local dev.

## 3. Databases: Docker locally, Supabase in production

| Environment | Database | Where the URL lives |
|-------------|----------|---------------------|
| Local development (`npm run dev`) | Docker `postgres:16-alpine` on `localhost:54329` | `.env.local` (`DATABASE_URL`, `DIRECT_URL`) |
| Vercel Preview + Production | Supabase project `yqqrikumjlwckhfbhanr` (`ap-southeast-2`) | Vercel → Settings → Environment Variables |

The code does not branch on environment: it simply connects to whatever `DATABASE_URL` says. TLS is verified for remote hosts; Supabase hosts automatically use the bundled Supabase root CA (`lib/supabase-ca.ts`), and localhost connects without TLS.

### 3.1 Migrations on an existing database (automatic)

The production schema was originally created with `prisma db push`, so it has no `_prisma_migrations` table and a plain `prisma migrate deploy` would refuse to run ("P3005: schema is not empty"). `scripts/db-deploy.ts` (used by `npm run db:deploy` and by `vercel-build`) handles this: if the application tables exist but the migration table does not, it marks `0001_init` as applied (one bookkeeping row; the live schema was verified drift-free against `prisma/schema.prisma`) and then applies any newer migrations. A brand-new database simply gets all migrations. No manual step is needed.

### 3.2 If Supabase is paused or deleted again

Free-tier projects are paused after a week of inactivity and deleted after a longer period.

1. **Supabase dashboard** → if the project is *Paused*, click *Restore*. If it is gone, create a new project (`ap-southeast-2` or `ap-south-1`).
2. **Connect** → copy the *Transaction pooler* URI (6543, keep `?pgbouncer=true`) into `DATABASE_URL` and the *Session pooler* URI (5432) into `DIRECT_URL` on Vercel (Production + Preview).
3. **Schema:** nothing to do — the next deployment runs `scripts/db-deploy.ts`, which baselines an existing schema or applies all migrations to a new one (§3.1).
4. **Redeploy** (Vercel → Deployments → Redeploy, or push a commit).
5. **Verify:** `https://<domain>/api/meal-plan?age=30&gender=male&heightCm=178&weightKg=80&activityLevel=moderate&goal=lose&dietType=vegetarian` returns `200` with `"source": "gemini"`, and sign-up works.
6. **Seed (optional):** `$env:DIRECT_URL="<session-pooler-uri>"; npm run db:seed -- --limit 300` to populate the USDA catalogue.

## 4. Local development against Docker

```bash
docker run -d --name nutriplan-pg -e POSTGRES_PASSWORD=nutriplan -e POSTGRES_USER=nutriplan -e POSTGRES_DB=nutriplan -p 54329:5432 postgres:16-alpine
# .env.local
DATABASE_URL="postgresql://nutriplan:nutriplan@localhost:54329/nutriplan"
DIRECT_URL="postgresql://nutriplan:nutriplan@localhost:54329/nutriplan"
npm run db:deploy
npm run dev
```

## 5. Observability & limits

- Server logs: Vercel → Project → Logs (route handlers log provider fallbacks as `[NutriPlan] … provider failed, trying next: …`; details only in dev).
- Rate limits are per serverless instance (in-memory). For a shared, exact limit across regions move `lib/rate-limit.ts` to Upstash Redis / Vercel KV — the store interface is a single `hit()` method.
- External quotas to watch: Gemini free tier (requests/min), USDA `DEMO_KEY` (30/h per IP), Unsplash demo (50/h).

## 6. Suggested improvements to the pipeline

- Protect `main`: require the CI workflow and at least one review before merge.
- Add `vercel.json` `"ignoreCommand"` or Vercel's *Deployment Protection* for previews if the app ever handles real user data in previews.
- Add a health endpoint (`/api/health` checking DB connectivity) and point Vercel Checks or an uptime monitor at it.
- Enable Vercel Speed Insights alongside Web Analytics.
