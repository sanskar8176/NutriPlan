import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const savePlanSchema = z.object({
  name: z.string().min(1).max(100).default("My Plan"),
  age: z.number().int().min(10).max(100),
  gender: z.string(),
  heightCm: z.number(),
  weightKg: z.number(),
  activityLevel: z.string(),
  goal: z.string(),
  targetRateKg: z.number().optional(),
  dietType: z.string(),
  allergies: z.array(z.string()).default([]),
  calories: z.number().int(),
  proteinG: z.number().int(),
  carbsG: z.number().int(),
  fatG: z.number().int(),
  bmr: z.number().int(),
  tdee: z.number().int(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = savePlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const plan = await prisma.plan.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(plan, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans);
}
