import { NextRequest, NextResponse } from "next/server";
import { getMealPlanFromDB } from "@/lib/meal-plan-db";
import type { DietTag } from "@/lib/food-data";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dietType  = (searchParams.get("dietType") ?? "non_veg") as DietTag;
  const calories  = Number(searchParams.get("calories") ?? 2000);
  const seed      = Number(searchParams.get("seed") ?? 0);
  const allergies = searchParams.get("allergies")?.split(",").filter(Boolean) ?? [];

  const meals = await getMealPlanFromDB(dietType, calories, allergies, seed);
  return NextResponse.json(meals);
}
