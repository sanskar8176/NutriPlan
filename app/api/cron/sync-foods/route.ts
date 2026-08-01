import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllFoods } from "@/lib/usda-sync";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const secret = req.headers.get("authorization");
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "USDA_API_KEY not set" }, { status: 500 });
  }

  // Load existing foods from DB to enable additive re-seeding
  const existing = await prisma.food.findMany({ select: { name: true, fdcId: true } });
  const existingNames  = new Set(existing.map((f) => f.name.toLowerCase().trim()));
  const existingFdcIds = new Set(existing.map((f) => f.fdcId));

  // fetchAllFoods skips anything already in existingNames/existingFdcIds
  const newFoods = await fetchAllFoods(apiKey, existingNames, existingFdcIds);

  if (newFoods.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No new foods found — DB is up to date.",
      existing: existing.length,
    });
  }

  let inserted = 0;
  let skipped  = 0;

  for (const food of newFoods) {
    try {
      await prisma.food.create({
        data: {
          fdcId:       food.fdcId,
          name:        food.name,
          calories:    food.calories,
          proteinG:    food.proteinG,
          carbsG:      food.carbsG,
          fatG:        food.fatG,
          fiberG:      food.fiberG,
          servingSize: food.servingSize,
          servingG:    food.servingG,
          image:       food.image,
          mealTimes:   food.mealTimes,
          dietTags:    food.dietTags,
          category:    food.category,
        },
      });
      inserted++;
    } catch {
      // Unique constraint race — skip silently
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    existing: existing.length,
    inserted,
    skipped,
    total: existing.length + inserted,
  });
}
