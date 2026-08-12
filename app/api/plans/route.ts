import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEV = process.env.NODE_ENV === "development";
function dbLog(op: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[35m[NutriPlan:DB:${op}]\x1b[0m`, ...args);
}

const mealItemSchema = z.object({
  foodId:      z.string(),
  mealTime:    z.string(),
  position:    z.number().int().default(0),
  aiGenerated: z.boolean().default(false),
});

const savePlanSchema = z.object({
  name:          z.string().min(1).max(100).default("My Plan"),
  age:           z.number().int().min(10).max(100),
  gender:        z.string(),
  heightCm:      z.number(),
  weightKg:      z.number(),
  activityLevel: z.string(),
  goal:          z.string(),
  targetRateKg:  z.number().optional(),
  dietType:      z.string(),
  allergies:     z.array(z.string()).default([]),
  calories:      z.number().int(),
  proteinG:      z.number().int(),
  carbsG:        z.number().int(),
  fatG:          z.number().int(),
  bmr:           z.number().int(),
  tdee:          z.number().int(),
  bmi:           z.number().optional(),
  meals:         z.array(mealItemSchema).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = savePlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { meals, ...planData } = parsed.data;

  dbLog("Plan:Create", `userId=${session.user.id}  meals=${meals.length}`);
  const plan = await prisma.plan.create({
    data: {
      ...planData,
      userId: session.user.id,
      meals: meals.length > 0 ? {
        create: meals.map((m) => ({
          foodId:      m.foodId,
          mealTime:    m.mealTime,
          position:    m.position,
          aiGenerated: m.aiGenerated,
        })),
      } : undefined,
    },
  });
  dbLog("Plan:Create:OK", `planId=${plan.id}  name="${plan.name}"`);

  return NextResponse.json(plan, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  dbLog("Plan:FindMany", `userId=${session.user.id}`);
  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  dbLog("Plan:FindMany:Result", `${plans.length} plans`);

  return NextResponse.json(plans);
}
