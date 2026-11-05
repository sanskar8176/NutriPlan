# NutriPlan — Architecture

Diagrams are written in [Mermaid](https://mermaid.js.org/); GitHub, VS Code (with the Mermaid extension) and most Markdown viewers render them inline.

## 1. System context

```mermaid
flowchart LR
    U[👤 User<br/>browser] -->|HTTPS| V[Vercel Edge/CDN]
    V --> N[Next.js 16 app<br/>Server Components + Route Handlers<br/>Vercel serverless functions]
    N -->|Prisma + pg over TLS| DB[(PostgreSQL<br/>Supabase)]
    N -->|@google/genai| G[Google Gemini]
    N -->|OpenAI-compatible HTTP<br/>optional| L[Local model<br/>Ollama / LM Studio]
    N -->|REST| USDA[USDA FoodData Central]
    N -->|REST| UNS[Unsplash API]
    N -->|OAuth 2 / OIDC| GO[Google Accounts]
    U -->|img src| IMG[images.unsplash.com]
    U -->|beacon| VA[Vercel Web Analytics]
```

## 2. Application layers

```mermaid
flowchart TB
    subgraph Client["Browser (React 19 client components)"]
        P[/plan form<br/>react-hook-form + zod/]
        R[/results dashboard/]
        D[/dashboard/]
        S[/sign-in form/]
    end

    subgraph Server["Next.js server (App Router)"]
        SC[Server pages<br/>app/page.tsx · app/dashboard/page.tsx]
        RH[Route handlers<br/>app/api/**]
        AUTH[auth.ts<br/>Auth.js v5]
    end

    subgraph Lib["lib/ — domain + data-access layer"]
        SCH[api-schemas.ts<br/>zod validation]
        CALC[calculations.ts<br/>BMR · TDEE · macros · BMI]
        SVC[meal-plan-service.ts<br/>provider chain + persistence]
        AI[ai-meal-plan.ts<br/>Gemini / local · USDA · Unsplash]
        MDB[meal-plan-db.ts<br/>plan from stored foods]
        STATIC[food-data.ts<br/>bundled catalogue]
        PLANS[plans.ts<br/>ownership-scoped plan DAL]
        RL[rate-limit.ts]
        ALG[allergens.ts]
        PR[prisma.ts]
    end

    P -->|router.push /results?…| R
    R -->|GET /api/meal-plan| RH
    R -->|POST /api/plans| RH
    D -->|DELETE /api/plans/:id| RH
    S -->|POST /api/auth/register · signIn()| RH
    RH --> AUTH
    RH --> SCH
    RH --> RL
    RH --> SVC
    RH --> PLANS
    SC --> PLANS
    SC --> PR
    SVC --> CALC
    SVC --> AI
    SVC --> MDB
    SVC --> STATIC
    AI --> ALG
    MDB --> ALG
    STATIC --> ALG
    PLANS --> CALC
    PLANS --> PR
    MDB --> PR
    SVC --> PR
    AUTH --> PR
```

**Principles**

- **Thin route handlers, fat `lib/`.** Handlers do auth → rate limit → validate → call a `lib/` function → shape the response. Business rules and DB access live in `lib/`, which is also where the unit tests point.
- **One schema set.** `lib/api-schemas.ts` is imported by both the client (results page validates its URL parameters) and the server (route handlers validate query/body). Enums for gender, activity, goal, diet and meal time are defined once.
- **Ownership is enforced in the DAL.** Every function in `lib/plans.ts` takes `userId` and scopes the query (`where: { id, userId }`), so a handler cannot forget the check.
- **Derived values are never trusted from the client.** Calories, macros, BMR, TDEE and BMI are recomputed on the server when a plan is saved.
- **Degrade, don't fail.** Meal generation is a chain of independent stages (see §4); every external dependency has a timeout.

## 3. Request flows (sequence diagrams)

### 3.1 Generate a plan (guest or signed-in)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant F as /plan (client)
    participant R as /results (client)
    participant API as GET /api/meal-plan
    participant SVC as meal-plan-service
    participant AI as ai-meal-plan
    participant GEM as Gemini
    participant USDA as USDA FDC
    participant UNS as Unsplash
    participant DB as PostgreSQL

    U->>F: fill 4 steps (zod-validated per step)
    F->>F: planInputSchema.safeParse(all steps)
    F->>R: router.push("/results?age=…&goal=…&dietType=…&allergies=…&bmi=…")
    R->>R: resultsParamsSchema.safeParse(URL) → computeNutritionPlan()
    R->>API: GET /api/meal-plan?age…&seed=0 (sessionStorage cache miss)
    API->>API: mealPlanQuerySchema.safeParse(query)
    API->>API: rateLimit("meal-plan:generate:<ip>", 12/10 min)
    API->>SVC: buildMealPlan(profile)
    SVC->>SVC: computeNutritionPlan() → calorie/macro targets
    loop providers: local → gemini
        SVC->>AI: generateAIMealPlan(profile, provider)
        AI->>GEM: generateContent(system + user prompt, JSON schema)
        GEM-->>AI: {meals:[5 items]}
        AI->>AI: zod-validate items · dedupe · enforceDiet · excludeAllergens
        par per meal
            AI->>USDA: /foods/search?query=<name>
            USDA-->>AI: nutrients (used only if within ±60 % of estimate)
            AI->>UNS: /search/photos?query=<name> food
            UNS-->>AI: image URL (host allow-listed)
        end
        AI-->>SVC: AIMealItem[]
    end
    SVC->>DB: upsert each Food by name (merge mealTimes/dietTags)
    DB-->>SVC: Food rows (ids)
    SVC-->>API: { meals, source: "gemini" }
    API-->>R: 200 { meals, source, saved:false } (Cache-Control: private, no-store)
    R->>R: cache in sessionStorage (keyed by query) · render
```

Fallbacks (not shown): if every AI provider throws, `SVC` tries `getMealPlanFromDB()` (foods already stored, allergen-filtered, seed-rotated); if the table is too small or the DB is down, `getStaticMealPlan()` from the bundled catalogue. The response's `source` tells the UI which one was used.

### 3.2 Save a plan

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant R as /results (client)
    participant API as POST /api/plans
    participant A as auth()
    participant DAL as lib/plans.ts
    participant DB as PostgreSQL

    U->>R: click "Save Plan"
    alt not signed in
        R->>R: router.push("/auth/signin?callbackUrl=<same-origin path>")
    else signed in
        R->>API: POST { profile, allergies, meals:[{foodId, mealTime, position, aiGenerated}] }
        API->>A: session?.user.id (401 if none)
        API->>API: rateLimit("plan-save:<userId>", 30/15 min)
        API->>API: readJsonBody (400 on malformed) · savePlanBodySchema (400 with issues)
        API->>DAL: createPlanForUser(userId, input)
        DAL->>DAL: computeNutritionPlan() + calculateBMI()  (client values ignored)
        DAL->>DB: resolve foodIds (materialise static catalogue items on first use; 400 for unknown ids)
        DAL->>DB: INSERT Plan + PlanMeal[]
        DB-->>DAL: Plan
        DAL-->>API: PlanDTO (no userId / internals)
        API-->>R: 201 PlanDTO
    end
```

### 3.3 Open a saved plan from the dashboard

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant D as /dashboard (server page)
    participant R as /results (client)
    participant API as GET /api/meal-plan?planId=…
    participant DAL as lib/plans.ts
    participant DB as PostgreSQL

    U->>D: GET /dashboard
    D->>D: auth() → redirect to sign-in if none
    D->>DAL: listPlansForUser(userId)
    DAL->>DB: SELECT Plan WHERE userId
    D-->>U: cards (PlanDTO[])
    U->>R: "View Plan" → /results?…&planId=X&fromSaved=1
    R->>API: GET /api/meal-plan?planId=X
    API->>API: auth() (401) · rateLimit(saved, 120/min)
    API->>DAL: getSavedPlanMeals(X, userId)
    DAL->>DB: SELECT Plan WHERE id=X AND userId=me  → 404 if none
    DAL->>DB: SELECT PlanMeal JOIN Food ORDER BY position
    API-->>R: 200 { meals, source:"database", saved:true }
```

### 3.4 Authentication

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant S as /auth/signin (client)
    participant REG as POST /api/auth/register
    participant NA as /api/auth/* (Auth.js)
    participant DB as PostgreSQL

    alt Sign up (credentials)
        U->>S: name, e-mail, password (≥ 8 chars)
        S->>REG: POST JSON
        REG->>REG: rateLimit(register:<ip>, 5/15 min) · registerSchema (e-mail lower-cased)
        REG->>DB: findUnique(email) → 409 if exists
        REG->>DB: create User { password: bcrypt(12) }
        REG-->>S: 201
    end
    S->>NA: signIn("credentials") → POST /api/auth/callback/credentials (CSRF token)
    NA->>NA: authorize(): loginSchema · rateLimit(login:<ip>, 10/15 min)
    NA->>DB: findUnique(email)
    NA->>NA: bcrypt.compare(password, hash ?? DUMMY_HASH)  (constant-time regardless of user existence)
    NA-->>S: JWT session cookie (HttpOnly, SameSite=Lax, Secure in prod)
    S->>S: router.push(safeRedirectPath(callbackUrl))  (same-origin paths only)
    opt Google
        U->>S: "Continue with Google" (button only rendered when configured)
        S->>NA: /api/auth/signin/google → Google → /api/auth/callback/google
        NA->>DB: PrismaAdapter upserts User + Account
    end
```

## 4. AI meal-plan pipeline

```mermaid
flowchart TD
    IN[Validated profile<br/>age · gender · height · weight · activity · goal · diet · allergies · seed] --> CALC[computeNutritionPlan<br/>kcal + protein/carbs/fat targets]
    CALC --> PROMPT[buildUserPrompt<br/>allergies sanitised to plain words]
    PROMPT --> P1{LOCAL_MODEL_* set?}
    P1 -->|yes| LOCAL[POST /v1/chat/completions<br/>json_schema · 30 s timeout]
    P1 -->|no| P2
    LOCAL -->|ok| VAL
    LOCAL -->|error| P2{GEMINI_API_KEY set?}
    P2 -->|yes| GEM[Gemini generateContent<br/>responseSchema · 45 s timeout<br/>retry ×2 on 429/503 · fallback model]
    P2 -->|no| DBF
    GEM -->|ok| VAL
    GEM -->|error| DBF[getMealPlanFromDB<br/>allergen keyword filter · seed rotation]
    DBF -->|≥10 foods| OUT
    DBF -->|too few / DB down| ST[getStaticMealPlan<br/>bundled catalogue]
    ST --> OUT
    VAL[Validate each item with zod<br/>clamp numbers · cap strings] --> DD[Dedupe by name]
    DD --> DIET[enforceDiet<br/>drop meat for veg/vegan, dairy/egg for vegan]
    DIET --> ALG[excludeAllergens<br/>keyword map: nuts→almond,cashew… dairy→paneer,ghee…]
    ALG --> X[per item, in parallel]
    X --> USDA[USDA cross-check<br/>accept if within ±60 % kcal]
    X --> IMG[Unsplash image<br/>allow-listed host, category fallback]
    USDA --> PERSIST
    IMG --> PERSIST[upsertAiFood<br/>Food by unique name · negative synthetic fdcId]
    PERSIST --> OUT[(MealPlanResponse<br/>meals by time + source)]
```

Why the model is only one input: the model proposes dishes; the app owns the hard constraints (diet, allergens, numeric sanity, image origin) and re-checks them in code. A hallucinated "Paneer Tikka" in a vegan plan, or a `calories: -5`, never reaches the UI or the database.

## 5. Data model

```mermaid
erDiagram
    User ||--o{ Account : "oauth accounts"
    User ||--o{ Session : "db sessions (unused with JWT)"
    User ||--o{ Plan : "saves"
    Plan ||--o{ PlanMeal : "contains"
    Food ||--o{ PlanMeal : "referenced by"

    User {
        string id PK "cuid"
        string email UK
        string name
        string password "bcrypt hash, null for OAuth-only"
        datetime emailVerified
        string image
    }
    Account {
        string id PK
        string userId FK
        string provider
        string providerAccountId
        string access_token
        string refresh_token
    }
    Plan {
        string id PK
        string userId FK "cascade delete"
        string name
        int age
        string gender
        float heightCm
        float weightKg
        string activityLevel
        string goal
        float targetRateKg
        string dietType
        string_array allergies
        int calories "server-computed"
        int proteinG
        int carbsG
        int fatG
        int bmr
        int tdee
        float bmi
        datetime createdAt
    }
    PlanMeal {
        string id PK
        string planId FK "cascade delete"
        string foodId FK "cascade delete"
        string mealTime "breakfast|lunch|dinner|snack"
        int position
        boolean aiGenerated
    }
    Food {
        string id PK
        int fdcId UK "USDA id, or negative synthetic for AI/static items"
        string name UK
        float calories
        float proteinG
        float carbsG
        float fatG
        float fiberG
        string servingSize
        float servingG
        string image "allow-listed https URL"
        string_array mealTimes
        string_array dietTags
        string category
        boolean isActive
        string description
    }
```

Indexes: `Food(dietTags)`, `Food(mealTimes)`, `Food(isActive)` (GIN-style array lookups for plan building), `PlanMeal(planId)`.

## 6. Rendering & caching

| Route | Mode | Notes |
|-------|------|-------|
| `/` | Static + ISR (1 h) | Meal preview from DB; falls back to static items if the DB is unavailable |
| `/plan`, `/results`, `/auth/*` | Static shell, client-rendered | Results reads the URL on the client inside `<Suspense>` |
| `/dashboard` | Dynamic (server) | Reads the session cookie; redirects when signed out |
| `/api/*` | Dynamic | `Cache-Control: private, no-store` (set globally in `next.config.ts`) |

Generated plans are cached in `sessionStorage` per query string so navigating back/forward does not re-trigger AI calls.

## 7. Security architecture (summary)

See [security-audit.md](security-audit.md) for the full list. In short: Auth.js JWT sessions; per-route auth + ownership checks in the DAL; zod validation at every boundary; in-memory rate limits per IP/user; CSP/HSTS/frame/MIME headers; TLS-verified DB connection; secrets only in environment variables; dependencies pinned to patched versions.
