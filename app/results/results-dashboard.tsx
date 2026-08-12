"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, RefreshCw, Flame, Beef, Wheat, Droplets,
  BookmarkCheck, Bookmark, Loader2, Sparkles, Database, Image as ImageIcon, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/index";
import { MacroDonutChart } from "@/components/charts/macro-donut";
import { computeNutritionPlan } from "@/lib/calculations";
import { getBMICategory } from "@/lib/calculations";
import type { UserStats } from "@/lib/calculations";
import type { DietTag, MealTime, FoodItem } from "@/lib/food-data";

const MEAL_LABELS: Record<MealTime, string> = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
  snack: "🍎 Snacks",
};

const MEAL_ORDER: MealTime[] = ["breakfast", "lunch", "dinner", "snack"];

const MACRO_CARDS = [
  { key: "calories" as const, label: "Daily Calories", unit: "kcal", icon: Flame, color: "text-orange-500" },
  { key: "proteinG" as const, label: "Protein", unit: "g", icon: Beef, color: "text-green-600" },
  { key: "carbsG" as const, label: "Carbs", unit: "g", icon: Wheat, color: "text-amber-500" },
  { key: "fatG" as const, label: "Fat", unit: "g", icon: Droplets, color: "text-orange-400" },
];

const AI_STAGES = [
  { icon: Sparkles,  label: "Asking AI nutritionist…",       detail: "Gemini is crafting your personalised meal plan" },
  { icon: Database,  label: "Cross-checking nutrition data…", detail: "Verifying calories & macros against USDA database" },
  { icon: ImageIcon, label: "Fetching food photos…",          detail: "Finding beautiful images for each meal" },
  { icon: CheckCircle2, label: "Finalising your plan…",       detail: "Almost ready!" },
];

function MealLoadingSkeleton({ fromSaved }: { fromSaved: boolean }) {
  const [stage, setStage] = useState(0);
  const [dots, setDots]   = useState("");

  useEffect(() => {
    if (fromSaved) return; // saved plans load fast — just show pulse
    const stageTimer = setInterval(() => setStage((s) => Math.min(s + 1, AI_STAGES.length - 1)), 6000);
    const dotsTimer  = setInterval(() => setDots((d) => d.length >= 3 ? "" : d + "."), 500);
    return () => { clearInterval(stageTimer); clearInterval(dotsTimer); };
  }, [fromSaved]);

  if (fromSaved) {
    return (
      <div className="grid sm:grid-cols-2 gap-5">
        {MEAL_ORDER.map((t) => (
          <div key={t} className="rounded-xl border border-[var(--border)] bg-[var(--card)] h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const current = AI_STAGES[stage];
  const Icon    = current.icon;

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      {/* Animated icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
          <Icon className="w-7 h-7 text-[var(--primary)] animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[var(--primary)]/30 animate-ping" />
      </div>

      {/* Stage text */}
      <div className="text-center">
        <p className="font-heading font-semibold text-lg">{current.label}{dots}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{current.detail}</p>
      </div>

      {/* Stage progress dots */}
      <div className="flex gap-2">
        {AI_STAGES.map((s, i) => (
          <motion.div
            key={s.label}
            className="h-2 rounded-full bg-[var(--primary)]"
            animate={{ width: i === stage ? 24 : 8, opacity: i <= stage ? 1 : 0.3 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* Skeleton cards */}
      <div className="w-full grid sm:grid-cols-2 gap-5 mt-2">
        {MEAL_ORDER.map((t, i) => (
          <motion.div
            key={t}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] h-28 overflow-hidden"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          >
            <div className="flex h-full">
              <div className="w-24 bg-[var(--muted)]/40 flex-shrink-0" />
              <div className="flex-1 p-3 flex flex-col gap-2 justify-center">
                <div className="h-3 bg-[var(--muted)]/40 rounded w-3/4" />
                <div className="h-2 bg-[var(--muted)]/30 rounded w-1/2" />
                <div className="h-2 bg-[var(--muted)]/20 rounded w-2/3" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function ResultsDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [seed, setSeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(params.get("fromSaved") === "1");
  const [saveError, setSaveError] = useState("");
  const [meals, setMeals] = useState<Record<MealTime, FoodItem[]> | null>(null);
  const [mealsLoading, setMealsLoading] = useState(true);
  const planId = params.get("planId");

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
  const bmi = Number(params.get("bmi") ?? 0) || undefined;
  const plan = computeNutritionPlan(stats);
  const goalLabel = { lose: "Weight Loss", maintain: "Maintenance", gain: "Muscle Gain" }[stats.goal];

  // Fetch meal plan — from saved planId (no AI) or fresh generation
  useEffect(() => {
    setMealsLoading(true);
    let url: string;
    if (planId) {
      url = `/api/meal-plan?planId=${planId}`;
    } else {
      const p = new URLSearchParams({
        dietType,
        calories:      String(plan.calories),
        proteinG:      String(plan.proteinG),
        carbsG:        String(plan.carbsG),
        fatG:          String(plan.fatG),
        age:           String(stats.age),
        gender:        stats.gender,
        weightKg:      String(stats.weightKg),
        heightCm:      String(stats.heightCm),
        goal:          stats.goal,
        activityLevel: stats.activityLevel,
        seed:          String(seed),
        allergies:     allergies.join(","),
      });
      url = `/api/meal-plan?${p.toString()}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => setMeals(data))
      .catch(() => setMeals(null))
      .finally(() => setMealsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, dietType, plan.calories, planId]);

  const handleSave = async () => {
    if (!session) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // Flatten current meals into the save payload
      const mealItems: Array<{ foodId: string; mealTime: string; position: number; aiGenerated: boolean }> = [];
      if (meals) {
        (Object.entries(meals) as [MealTime, FoodItem[]][]).forEach(([mt, items]) => {
          items.forEach((item, idx) => {
            mealItems.push({ foodId: item.id, mealTime: mt, position: idx, aiGenerated: item.aiGenerated ?? false });
          });
        });
      }

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
          bmi,
          meals: mealItems,
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
          <Button variant="outline" size="sm" onClick={() => { setSeed((s) => s + 100); setSaved(false); }} disabled={!!planId}>
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
        </div>

        {/* Macro summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

        {/* BMI card */}
        {bmi && bmi > 0 && (() => {
          const bmiInfo = getBMICategory(bmi);
          const bmiPct  = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-8">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Body Mass Index (BMI)</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--secondary)] ${bmiInfo.color}`}>{bmiInfo.category}</span>
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className={`font-heading text-3xl font-bold ${bmiInfo.color}`}>{bmi}</span>
                  <span className="text-xs text-[var(--muted-foreground)] mb-1">kg/m²</span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-green-400 via-amber-400 to-red-500">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--foreground)] shadow"
                    style={{ left: `calc(${bmiPct}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
                  <span>Underweight &lt;18.5</span><span>Normal 18.5–25</span><span>Overweight 25–30</span><span>Obese &gt;30</span>
                </div>
              </Card>
            </motion.div>
          );
        })()}

        {/* Chart + breakdown */}
        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle>Macro Breakdown</CardTitle></CardHeader>
            <CardContent>
              <MacroDonutChart proteinG={plan.proteinG} carbsG={plan.carbsG} fatG={plan.fatG} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>How We Got Here</CardTitle></CardHeader>
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

          {mealsLoading ? (
            <MealLoadingSkeleton fromSaved={!!planId} />
          ) : meals ? (
            <AnimatePresence>
            <div className="grid sm:grid-cols-2 gap-5">
              {MEAL_ORDER.map((time) => {
                const items: FoodItem[] = meals[time] ?? [];
                if (items.length === 0) return null;
                return (
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
                                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="96px" />
                              </div>
                              <CardContent className="p-3 flex flex-col justify-between flex-1">
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                                    {item.aiGenerated && (
                                      <span className="text-[10px] bg-[var(--primary)]/10 text-[var(--primary)] rounded-full px-1.5 py-0.5 whitespace-nowrap flex-shrink-0">✦ AI</span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-snug line-clamp-2">{item.description}</p>
                                  )}
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
                );
              })}
            </div>
            </AnimatePresence>
          ) : (
            <p className="text-[var(--muted-foreground)] text-sm">Could not load meal plan. Try regenerating.</p>
          )}
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
                  ? params.get("fromSaved") === "1"
                    ? "This plan is already in your dashboard."
                    : "View it anytime in your dashboard."
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
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><Bookmark className="h-4 w-4" /> {session ? "Save Plan" : "Sign Up & Save"}</>}
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
