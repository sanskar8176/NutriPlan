// Route-handler tests with the auth layer and the data layer mocked.
// These lock in the security behaviour: auth required, ownership enforced,
// input validated, malformed bodies answered with 400 (never 500).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock is hoisted above imports, so everything the factories reference must be hoisted too.
const { authMock, plansMock, buildMealPlanMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  plansMock: {
    getSavedPlanMeals: vi.fn(),
    createPlanForUser: vi.fn(),
    listPlansForUser: vi.fn(),
    deletePlanForUser: vi.fn(),
  },
  buildMealPlanMock: vi.fn(),
  prismaMock: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/plans", async () => {
  const actual = await vi.importActual<typeof import("@/lib/plans")>("@/lib/plans");
  return { ...plansMock, UnknownFoodError: actual.UnknownFoodError };
});
vi.mock("@/lib/meal-plan-service", () => ({ buildMealPlan: (...a: unknown[]) => buildMealPlanMock(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET as mealPlanGET } from "@/app/api/meal-plan/route";
import { GET as plansGET, POST as plansPOST } from "@/app/api/plans/route";
import { DELETE as planDELETE } from "@/app/api/plans/[id]/route";
import { POST as registerPOST } from "@/app/api/auth/register/route";

let ipCounter = 0;
/** Fresh client IP per request so the in-memory rate limiter never interferes between tests. */
function req(url: string, init?: RequestInit) {
  ipCounter += 1;
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", `10.0.${Math.floor(ipCounter / 255)}.${ipCounter % 255}`);
  return new NextRequest(new URL(url, "http://localhost"), { ...init, headers });
}

const validProfileQuery = "age=30&gender=male&heightCm=178&weightKg=80&activityLevel=moderate&goal=lose&dietType=vegetarian";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(null);
});

describe("GET /api/meal-plan?planId", () => {
  it("requires authentication", async () => {
    const res = await mealPlanGET(req("/api/meal-plan?planId=abc"));
    expect(res.status).toBe(401);
    expect(plansMock.getSavedPlanMeals).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the signed-in user and 404s plans owned by others", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    plansMock.getSavedPlanMeals.mockResolvedValue(null);
    const res = await mealPlanGET(req("/api/meal-plan?planId=someone-elses"));
    expect(res.status).toBe(404);
    expect(plansMock.getSavedPlanMeals).toHaveBeenCalledWith("someone-elses", "user-1");
  });

  it("returns the owner's meals with the saved flag", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const meals = { breakfast: [{ id: "f1" }], lunch: [], dinner: [], snack: [] };
    plansMock.getSavedPlanMeals.mockResolvedValue(meals);
    const res = await mealPlanGET(req("/api/meal-plan?planId=mine"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ meals, source: "database", saved: true });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("GET /api/meal-plan (generate)", () => {
  it("rejects an invalid profile with 400 and never calls the AI pipeline", async () => {
    const res = await mealPlanGET(req("/api/meal-plan?age=5&gender=x"));
    expect(res.status).toBe(400);
    expect(buildMealPlanMock).not.toHaveBeenCalled();
  });

  it("passes a validated, typed profile to the service", async () => {
    buildMealPlanMock.mockResolvedValue({ meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, source: "static" });
    const res = await mealPlanGET(req(`/api/meal-plan?${validProfileQuery}&allergies=Nuts,Dairy&seed=7`));
    expect(res.status).toBe(200);
    const arg = buildMealPlanMock.mock.calls[0][0];
    expect(arg).toMatchObject({ age: 30, dietType: "vegetarian", allergies: ["Nuts", "Dairy"], seed: 7 });
    expect(await res.json()).toMatchObject({ source: "static", saved: false });
  });

  it("answers 500 without leaking the error when the service throws", async () => {
    buildMealPlanMock.mockRejectedValue(new Error("secret internal detail"));
    const res = await mealPlanGET(req(`/api/meal-plan?${validProfileQuery}`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret internal detail");
  });

  it("rate-limits repeated generations from one IP", async () => {
    buildMealPlanMock.mockResolvedValue({ meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, source: "static" });
    const headers = { "x-forwarded-for": "203.0.113.9" };
    let last = 200;
    for (let i = 0; i < 20; i++) {
      const res = await mealPlanGET(new NextRequest(new URL(`/api/meal-plan?${validProfileQuery}`, "http://localhost"), { headers }));
      last = res.status;
      if (last === 429) {
        expect(res.headers.get("retry-after")).toBeTruthy();
        break;
      }
    }
    expect(last).toBe(429);
  });
});

describe("/api/plans", () => {
  const body = {
    name: "Test", age: 30, gender: "male", heightCm: 178, weightKg: 80,
    activityLevel: "moderate", goal: "lose", dietType: "vegetarian", allergies: [],
    meals: [{ foodId: "food-1", mealTime: "lunch", position: 0, aiGenerated: true }],
  };

  it("GET and POST require authentication", async () => {
    expect((await plansGET()).status).toBe(401);
    const res = await plansPOST(req("/api/plans", { method: "POST", body: JSON.stringify(body) }));
    expect(res.status).toBe(401);
  });

  it("POST answers 400 for malformed JSON instead of crashing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const res = await plansPOST(req("/api/plans", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(400);
  });

  it("POST validates the body (bad enum → 400 with issues)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const res = await plansPOST(req("/api/plans", { method: "POST", body: JSON.stringify({ ...body, goal: "bulk" }) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.issues.some((i: { path: string }) => i.path === "goal")).toBe(true);
  });

  it("POST creates the plan for the session user, ignoring client macros", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    plansMock.createPlanForUser.mockResolvedValue({ id: "plan-1", name: "Test" });
    const res = await plansPOST(req("/api/plans", { method: "POST", body: JSON.stringify({ ...body, calories: 1, userId: "attacker" }) }));
    expect(res.status).toBe(201);
    const [userId, input] = plansMock.createPlanForUser.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(input).not.toHaveProperty("calories");
    expect(input).not.toHaveProperty("userId");
  });

  it("DELETE only removes plans owned by the caller", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    plansMock.deletePlanForUser.mockResolvedValue(false);
    const res = await planDELETE(req("/api/plans/other", { method: "DELETE" }), { params: Promise.resolve({ id: "other" }) });
    expect(res.status).toBe(404);
    expect(plansMock.deletePlanForUser).toHaveBeenCalledWith("other", "user-1");
  });
});

describe("POST /api/auth/register", () => {
  it("answers 400 for malformed JSON", async () => {
    const res = await registerPOST(req("/api/auth/register", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });

  it("enforces the password policy", async () => {
    const res = await registerPOST(req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "A", email: "a@b.co", password: "short" }) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8 characters/);
  });

  it("normalises the e-mail and hashes the password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u" });
    const res = await registerPOST(req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: " Sam ", email: "Sam@Example.com", password: "longenough1" }) }));
    expect(res.status).toBe(201);
    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data.email).toBe("sam@example.com");
    expect(data.name).toBe("Sam");
    expect(data.password).toMatch(/^\$2[aby]\$12\$/);
    expect(data.password).not.toBe("longenough1");
  });

  it("returns 409 for an existing e-mail", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "exists" });
    const res = await registerPOST(req("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "A", email: "a@b.co", password: "longenough1" }) }));
    expect(res.status).toBe(409);
  });
});
