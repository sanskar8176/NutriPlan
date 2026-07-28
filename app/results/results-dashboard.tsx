"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { ArrowLeft, RefreshCw, Flame, Beef, Wheat, Droplets, BookmarkCheck, Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/index";
import { MacroDonutChart } from "@/components/charts/macro-donut";
import { computeNutritionPlan } from "@/lib/calculations";
import { getMealPlan } from "@/lib/food-data";
import type { UserStats } from "@/lib/calculations";
import type { DietTag, MealTime } from "@/lib/food-data";

const MEAL_LABELS: Record<MealTime, string> = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
  snack: "🍎 Snacks",
};

const MACRO_CARDS = [
  { key: "calories" as const, label: "Daily Calories", unit: "kcal", icon: Flame, color: "text-orange-500" },
  { key: "proteinG" as const, label: "Protein", unit: "g", icon: Beef, color: "text-green-600" },
  { key: "carbsG" as const, label: "Carbs", unit: "g", icon: Wheat, color: "text-amber-500" },
  { key: "fatG" as const, label: "Fat", unit: "g", icon: Droplets, color: "text-orange-400" },
];

export function ResultsDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [seed, setSeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const stats: UserStats = {
    age: Number(params.get("age") ?? 25),
    gender: (params.get("gender") ?? "male") as UserStats["gender"],
    heightCm: Number(params.get("heightCm") ?? 175),
    weightKg: Number(params.get("weightKg") ?? 70),
    activityLevel: (params.get("activityLevel") ?? "moderate") as UserStats["activityLevel"],
    goal: (params.get("goal") ?? "maintain") as UserStats["goal"],
    targetRateKg: Number(params.get("targetRateKg") ?? 0.5),
  };

  const dietType = (params.get("dietType") ?? "non_veg") as DietTag;
  const allergies = params.get("allergies")?.split(",").filter(Boolean) ?? [];

  const plan = computeNutritionPlan(stats);
  const meals = getMealPlan(dietType, plan.calories + seed, allergies);

  const goalLabel = { lose: "Weight Loss", maintain: "Maintenance", gain: "Muscle Gain" }[stats.goal];

  const handleSave = async () => {
    if (!session) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${goalLabel} Plan`,
          age: stats.age,
          gender: stats.gender,
          heightCm: stats.heightCm,
          weightKg: stats.weightKg,
          activityLevel: stats.activityLevel,
          goal: stats.goal,
          targetRateKg: stats.targetRateKg,
          dietType,
          allergies,
          calories: plan.calories,
          proteinG: plan.proteinG,
          carbsG: plan.carbsG,
          fatG: plan.fatG,
          bmr: plan.bmr,
          tdee: plan.tdee,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save plan");
      } else {
        setSaved(true);
      }
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-10 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => router.push("/plan")}>
            <ArrowLeft className="h-4 w-4" /> Edit Plan
          </Button>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold">Your {goalLabel} Plan</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              BMR: {plan.bmr} kcal · TDEE: {plan.tdee} kcal
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSeed((s) => s + 100); setSaved(false); }}>
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
        </div>

        {/* Macro summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {MACRO_CARDS.map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="text-center p-4">
                <m.icon className={`h-6 w-6 mx-auto mb-2 ${m.color}`} />
                <div className="font-heading text-2xl font-bold">
                  {plan[m.key]}
                  <span className="text-sm font-normal text-[var(--muted-foreground)] ml-1">{m.unit}</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">{m.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Chart + breakdown */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader>
              <CardTitle>Macro Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MacroDonutChart
                proteinG={plan.proteinG}
                carbsG={plan.carbsG}
                fatG={plan.fatG}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Got Here</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-2">
              {[
                { label: "Basal Metabolic Rate (BMR)", value: `${plan.bmr} kcal`, desc: "Calories your body burns at rest" },
                { label: "Total Daily Energy (TDEE)", value: `${plan.tdee} kcal`, desc: `BMR × ${stats.activityLevel.replace("_", " ")} multiplier` },
                {
                  label: "Goal Adjustment",
                  value: stats.goal === "maintain" ? "None" : stats.goal === "lose" ? `−${plan.tdee - plan.calories} kcal` : `+${plan.calories - plan.tdee} kcal`,
                  desc: `For ${stats.goal === "maintain" ? "maintenance" : `${stats.targetRateKg ?? 0.5}kg/week`}`,
                },
                { label: "Your Daily Target", value: `${plan.calories} kcal`, desc: "What you should eat each day", highlight: true },
              ].map((row) => (
                <div key={row.label} className={`flex items-start justify-between gap-4 rounded-lg p-3 ${row.highlight ? "bg-[var(--accent)]" : "bg-[var(--secondary)]/50"}`}>
                  <div>
                    <div className={`text-sm font-medium ${row.highlight ? "text-[var(--primary)]" : ""}`}>{row.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{row.desc}</div>
                  </div>
                  <div className={`font-heading font-bold text-sm whitespace-nowrap ${row.highlight ? "text-[var(--primary)]" : ""}`}>{row.value}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Meal plan */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-2xl font-bold">Today&apos;s Meal Plan</h2>
            <span className="text-sm text-[var(--muted-foreground)] capitalize">{dietType.replace("_", "-")} diet</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {(Object.entries(meals) as [MealTime, typeof meals.breakfast][]).map(([time, items]) => (
              <div key={time}>
                <h3 className="font-heading font-semibold text-sm text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                  {MEAL_LABELS[time]}
                </h3>
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex">
                          <div className="relative w-24 h-24 flex-shrink-0">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="96px"
                            />
                          </div>
                          <CardContent className="p-3 flex flex-col justify-between flex-1">
                            <div>
                              <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.servingSize}</p>
                            </div>
                            <div className="flex gap-3 text-xs mt-2">
                              <span className="text-orange-500 font-medium">{item.calories} kcal</span>
                              <span className="text-green-600">P: {item.proteinG}g</span>
                              <span className="text-amber-500">C: {item.carbsG}g</span>
                              <span className="text-orange-400">F: {item.fatG}g</span>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save CTA */}
        <Card className="bg-[var(--accent)] border-[var(--primary)]/30 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-xl font-bold mb-1">
                {saved ? "Plan saved! 🎉" : session ? "Save this plan" : "Save your plan"}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {saved
                  ? "View it anytime in your dashboard."
                  : session
                  ? "Add this plan to your dashboard to track progress."
                  : "Create a free account to save this plan and track progress."}
              </p>
              {saveError && <p className="text-sm text-[var(--destructive)] mt-1">{saveError}</p>}
            </div>
            <div className="flex gap-3 flex-shrink-0">
              {saved ? (
                <Button onClick={() => router.push("/dashboard")}>
                  <BookmarkCheck className="h-4 w-4" /> View Dashboard
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || status === "loading"}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  ) : (
                    <><Bookmark className="h-4 w-4" /> {session ? "Save Plan" : "Sign Up & Save"}</>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push("/plan")}>Start Over</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
