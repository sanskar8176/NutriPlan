// Local type mirror of the Prisma Plan model — used before `prisma generate` runs
export interface Plan {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  goal: string;
  targetRateKg: number | null;
  dietType: string;
  allergies: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
}
