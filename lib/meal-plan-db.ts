import { prisma } from "@/lib/prisma";
import { getMealPlan as getStaticMealPlan } from "@/lib/food-data";
import type { MealTime, DietTag, FoodItem } from "@/lib/food-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbFoodToItem(f: any): FoodItem {
  return {
    id:          f.id,
    name:        f.name,
    calories:    Math.round(f.calories),
    proteinG:    Math.round(f.proteinG),
    carbsG:      Math.round(f.carbsG),
    fatG:        Math.round(f.fatG),
    mealTime:    f.mealTimes as MealTime[],
    dietTags:    f.dietTags as DietTag[],
    image:       f.image,
    servingSize: f.servingSize,
  };
}

export async function getMealPlanFromDB(
  dietType: DietTag,
  targetCalories: number,
  allergies: string[] = [],
  seed = 0
): Promise<Record<MealTime, FoodItem[]>> {
  const count = await prisma.food.count({ where: { isActive: true } });

  if (count < 10) {
    return getStaticMealPlan(dietType, targetCalories + seed, allergies);
  }

  // Fetch a large pool per meal time, then pick uniquely across all slots
  const allergyWhere = allergies.length > 0
    ? { NOT: { name: { in: allergies.map((a) => a.toLowerCase()) } } }
    : {};

  const fetchPool = async (mealTime: MealTime) => {
    const rows = await prisma.food.findMany({
      where: {
        isActive:  true,
        mealTimes: { has: mealTime },
        dietTags:  { has: dietType },
        ...allergyWhere,
      },
      orderBy: { fdcId: "asc" },
      take: 50,
    });

    if (rows.length === 0) {
      // Fallback: ignore diet filter, just match meal time
      return prisma.food.findMany({
        where: { isActive: true, mealTimes: { has: mealTime } },
        orderBy: { fdcId: "asc" },
        take: 50,
      });
    }
    return rows;
  };

  const [bfPool, lunchPool, dinnerPool, snackPool] = await Promise.all([
    fetchPool("breakfast"),
    fetchPool("lunch"),
    fetchPool("dinner"),
    fetchPool("snack"),
  ]);

  // Rotate each pool by seed for variety on regenerate
  const rotate = <T>(arr: T[], offset: number) => {
    if (arr.length === 0) return arr;
    const o = offset % arr.length;
    return [...arr.slice(o), ...arr.slice(0, o)];
  };

  const bfRotated     = rotate(bfPool,     seed);
  const lunchRotated  = rotate(lunchPool,  seed + 7);
  const dinnerRotated = rotate(dinnerPool, seed + 13);
  const snackRotated  = rotate(snackPool,  seed + 3);

  // Pick unique items across all slots — shared usedIds set
  const usedIds = new Set<string>();

  const pickUnique = (pool: typeof bfPool, limit: number): FoodItem[] => {
    const picked: FoodItem[] = [];
    for (const row of pool) {
      if (picked.length >= limit) break;
      if (usedIds.has(row.id)) continue;
      usedIds.add(row.id);
      picked.push(dbFoodToItem(row));
    }
    return picked;
  };

  // Pick in order: breakfast → lunch → dinner → snack
  const breakfast = pickUnique(bfRotated,     1);
  const lunch     = pickUnique(lunchRotated,  1);
  const dinner    = pickUnique(dinnerRotated, 1);
  const snack     = pickUnique(snackRotated,  2);

  return { breakfast, lunch, dinner, snack };
}
