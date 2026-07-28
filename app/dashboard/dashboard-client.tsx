"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, Flame, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/index";
import type { Plan } from "@prisma/client";

export function DashboardClient({ plans: initial, userName }: { plans: Plan[]; userName: string }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initial);

  const deletePlan = async (id: string) => {
    await fetch(`/api/plans/${id}`, { method: "DELETE" });
    setPlans((p) => p.filter((x) => x.id !== id));
  };

  const goalLabel = (g: string) =>
    ({ lose: "Weight Loss", maintain: "Maintenance", gain: "Muscle Gain" }[g] ?? g);

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-heading text-3xl font-bold">Hey, {userName} 👋</h1>
            <p className="text-[var(--muted-foreground)] mt-1">Your saved nutrition plans</p>
          </div>
          <Button onClick={() => router.push("/plan")}>
            <Plus className="h-4 w-4" /> New Plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="text-5xl mb-4">🥗</div>
              <h2 className="font-heading text-xl font-semibold mb-2">No plans yet</h2>
              <p className="text-[var(--muted-foreground)] mb-6">Build your first personalized meal plan in under 2 minutes.</p>
              <Button onClick={() => router.push("/plan")}>Build My Plan</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-heading font-semibold">{plan.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(plan.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePlan(plan.id)}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors p-1"
                        aria-label="Delete plan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-2.5 py-0.5 text-xs font-medium">
                        {goalLabel(plan.goal)}
                      </span>
                      <span className="rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] px-2.5 py-0.5 text-xs font-medium capitalize">
                        {plan.dietType.replace("_", "-")}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "kcal", value: plan.calories, color: "text-orange-500" },
                        { label: "protein", value: `${plan.proteinG}g`, color: "text-green-600" },
                        { label: "carbs", value: `${plan.carbsG}g`, color: "text-amber-500" },
                        { label: "fat", value: `${plan.fatG}g`, color: "text-orange-400" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg bg-[var(--secondary)]/50 py-2">
                          <div className={`font-heading font-bold text-sm ${m.color}`}>{m.value}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => {
                        const p = new URLSearchParams({
                          age: String(plan.age),
                          gender: plan.gender,
                          heightCm: String(plan.heightCm),
                          weightKg: String(plan.weightKg),
                          activityLevel: plan.activityLevel,
                          goal: plan.goal,
                          targetRateKg: String(plan.targetRateKg ?? 0.5),
                          dietType: plan.dietType,
                          allergies: plan.allergies.join(","),
                        });
                        router.push(`/results?${p.toString()}`);
                      }}
                    >
                      <Flame className="h-3.5 w-3.5" /> View Plan
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
