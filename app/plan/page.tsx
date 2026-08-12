"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, User, Activity, Target, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Progress, Card, CardContent } from "@/components/ui/index";
import { step1Schema, step2Schema, step3Schema, step4Schema } from "@/lib/validations";
import type { Step1Data, Step2Data, Step3Data, Step4Data } from "@/lib/validations";
import { lbsToKg, ftInToCm, calculateBMI, getBMICategory } from "@/lib/calculations";

const STEPS = [
  { title: "Your Basics", icon: User, desc: "Age, height, weight" },
  { title: "Activity Level", icon: Activity, desc: "How active are you?" },
  { title: "Your Goal", icon: Target, desc: "What do you want to achieve?" },
  { title: "Diet Preferences", icon: Salad, desc: "Food type & allergies" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise, desk job" },
  { value: "light", label: "Lightly Active", desc: "Light exercise 1–3 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "Moderate exercise 3–5 days/week" },
  { value: "active", label: "Very Active", desc: "Hard exercise 6–7 days/week" },
  { value: "very_active", label: "Extra Active", desc: "Very hard exercise + physical job" },
];

const GOAL_OPTIONS = [
  { value: "lose", label: "Lose Weight", desc: "Calorie deficit to burn fat", emoji: "🔥" },
  { value: "maintain", label: "Maintain Weight", desc: "Stay at current weight", emoji: "⚖️" },
  { value: "gain", label: "Build Muscle", desc: "Calorie surplus to gain mass", emoji: "💪" },
];

const DIET_OPTIONS = [
  { value: "non_veg", label: "Non-Vegetarian", emoji: "🍗" },
  { value: "vegetarian", label: "Vegetarian", emoji: "🥗" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "eggetarian", label: "Eggetarian", emoji: "🥚" },
  { value: "keto", label: "Keto", emoji: "🥑" },
];

const ALLERGY_OPTIONS = ["Nuts", "Dairy", "Gluten", "Soy", "Shellfish", "Eggs"];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function PlanPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [formData, setFormData] = useState<Partial<Step1Data & Step2Data & Step3Data & Step4Data>>({
    unit: "metric",
    activityLevel: "moderate",
    goal: "maintain",
    dietType: "non_veg",
    allergies: [],
  });

  const step1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema), defaultValues: formData as Step1Data });
  const step2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: formData as Step2Data });
  const step3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: formData as Step3Data });
  const step4 = useForm<Step4Data>(
    // @ts-expect-error — zod .default() creates input/output type mismatch with RHF resolver
    { resolver: zodResolver(step4Schema), defaultValues: { dietType: "non_veg" as const, allergies: [] } }
  );

  const forms = [step1, step2, step3, step4];
  const currentForm = forms[step];

  const go = (newStep: number) => {
    setDir(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  const handleNext = async () => {
    const valid = await currentForm.trigger();
    if (!valid) return;
    const values = currentForm.getValues();
    setFormData((prev) => ({ ...prev, ...values }));
    if (step < 3) { go(step + 1); return; }

    // Final step — build query and navigate to results
    const merged = { ...formData, ...values } as Step1Data & Step2Data & Step3Data & Step4Data;
    const unit = merged.unit ?? "metric";
    const heightCm = unit === "metric"
      ? (merged.heightCm ?? 170)
      : ftInToCm(merged.heightFt ?? 5, merged.heightIn ?? 7);
    const weightKg = unit === "metric"
      ? (merged.weightKg ?? 70)
      : lbsToKg(merged.weightLbs ?? 154);

    const params = new URLSearchParams({
      age: String(merged.age),
      gender: merged.gender,
      heightCm: String(heightCm),
      weightKg: String(weightKg),
      activityLevel: merged.activityLevel,
      goal: merged.goal,
      targetRateKg: String(merged.targetRateKg ?? 0.5),
      dietType: merged.dietType,
      allergies: (merged.allergies ?? []).join(","),
      bmi: String(calculateBMI(weightKg, heightCm)),
    });
    router.push(`/results?${params.toString()}`);
  };

  const unit = step1.watch("unit") ?? formData.unit ?? "metric";

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="mx-auto max-w-xl">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Step {step + 1} of {STEPS.length}</span>
            <span className="text-sm font-medium text-[var(--primary)]">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <div className="flex justify-between mt-3">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => i < step && go(i)}
                className={`flex flex-col items-center gap-1 text-xs transition-colors ${i <= step ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} ${i < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${i < step ? "bg-[var(--primary)] border-[var(--primary)]" : i === step ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)]"}`}>
                  <s.icon className={`h-4 w-4 ${i <= step ? "text-[var(--primary)]" : ""} ${i < step ? "text-white" : ""}`} />
                </div>
                <span className="hidden sm:block">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form card */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <h2 className="font-heading text-2xl font-bold mb-1">{STEPS[step].title}</h2>
                <p className="text-[var(--muted-foreground)] text-sm mb-6">{STEPS[step].desc}</p>

                {step === 0 && <Step1Form form={step1} unit={unit} />}
                {step === 1 && <Step2Form form={step2} />}
                {step === 2 && <Step3Form form={step3} />}
                {step === 3 && <Step4Form form={step4 as unknown as ReturnType<typeof useForm<Step4Data>>} />}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => go(step - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={handleNext}>
            {step === 3 ? "Generate My Plan" : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Step sub-forms ──────────────────────────────────────────────────────────

function Step1Form({ form, unit }: { form: ReturnType<typeof useForm<Step1Data>>; unit: string }) {
  const { register, watch, setValue, formState: { errors } } = form;
  const currentUnit = watch("unit") ?? unit;

  // Live BMI calculation
  const heightCm  = Number(watch("heightCm")  ?? 0);
  const weightKg  = Number(watch("weightKg")  ?? 0);
  const heightFt  = Number(watch("heightFt")  ?? 0);
  const heightIn  = Number(watch("heightIn")  ?? 0);
  const weightLbs = Number(watch("weightLbs") ?? 0);

  const resolvedHeightCm = currentUnit === "metric" ? heightCm  : ftInToCm(heightFt, heightIn);
  const resolvedWeightKg = currentUnit === "metric" ? weightKg  : lbsToKg(weightLbs);
  const bmi = calculateBMI(resolvedWeightKg, resolvedHeightCm);
  const bmiInfo = bmi > 0 ? getBMICategory(bmi) : null;

  // BMI scale: 15 (left) to 40 (right)
  const bmiPct = bmi > 0 ? Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100)) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Unit toggle */}
      <div>
        <Label className="mb-2 block">Units</Label>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden w-fit">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setValue("unit", u)}
              className={`px-5 py-2 text-sm font-medium transition-colors capitalize ${currentUnit === u ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--secondary)]"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="age" className="mb-1.5 block">Age</Label>
          <Input id="age" type="number" placeholder="25" {...register("age")} />
          {errors.age && <p className="text-xs text-[var(--destructive)] mt-1">{errors.age.message}</p>}
        </div>
        <div>
          <Label className="mb-1.5 block">Gender</Label>
          <div className="flex gap-2">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => form.setValue("gender", g)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-all ${form.watch("gender") === g ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--primary)]/50"}`}
              >
                {g}
              </button>
            ))}
          </div>
          {errors.gender && <p className="text-xs text-[var(--destructive)] mt-1">{errors.gender.message}</p>}
        </div>
      </div>

      {currentUnit === "metric" ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="heightCm" className="mb-1.5 block">Height (cm)</Label>
            <Input id="heightCm" type="number" placeholder="175" {...register("heightCm")} />
            {errors.heightCm && <p className="text-xs text-[var(--destructive)] mt-1">{errors.heightCm.message}</p>}
          </div>
          <div>
            <Label htmlFor="weightKg" className="mb-1.5 block">Weight (kg)</Label>
            <Input id="weightKg" type="number" placeholder="70" {...register("weightKg")} />
            {errors.weightKg && <p className="text-xs text-[var(--destructive)] mt-1">{errors.weightKg.message}</p>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="heightFt" className="mb-1.5 block">Feet</Label>
            <Input id="heightFt" type="number" placeholder="5" {...register("heightFt")} />
          </div>
          <div>
            <Label htmlFor="heightIn" className="mb-1.5 block">Inches</Label>
            <Input id="heightIn" type="number" placeholder="10" {...register("heightIn")} />
          </div>
          <div>
            <Label htmlFor="weightLbs" className="mb-1.5 block">Weight (lbs)</Label>
            <Input id="weightLbs" type="number" placeholder="154" {...register("weightLbs")} />
          </div>
        </div>
      )}

      {/* Live BMI card */}
      {bmiInfo && bmi > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Your BMI</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--background)] ${bmiInfo.color}`}>
              {bmiInfo.category}
            </span>
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className={`font-heading text-3xl font-bold ${bmiInfo.color}`}>{bmi}</span>
            <span className="text-xs text-[var(--muted-foreground)] mb-1">kg/m²</span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-green-400 via-amber-400 to-red-500">
            {bmiPct !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[var(--foreground)] shadow"
                style={{ left: `calc(${bmiPct}% - 6px)` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
            <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Step2Form({ form }: { form: ReturnType<typeof useForm<Step2Data>> }) {
  const selected = form.watch("activityLevel");
  return (
    <div className="flex flex-col gap-3">
      {ACTIVITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => form.setValue("activityLevel", opt.value as Step2Data["activityLevel"])}
          className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${selected === opt.value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--primary)]/40"}`}
        >
          <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all ${selected === opt.value ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--muted-foreground)]"}`} />
          <div>
            <div className="font-medium text-sm">{opt.label}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{opt.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Step3Form({ form }: { form: ReturnType<typeof useForm<Step3Data>> }) {
  const selected = form.watch("goal");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => form.setValue("goal", opt.value as Step3Data["goal"])}
            className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${selected === opt.value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--primary)]/40"}`}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <div>
              <div className="font-semibold text-sm">{opt.label}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      {selected !== "maintain" && (
        <div>
          <Label htmlFor="targetRateKg" className="mb-1.5 block">
            Target rate (kg/week) — 0.25 to 1.0
          </Label>
          <Input
            id="targetRateKg"
            type="number"
            step="0.25"
            min="0.1"
            max="1.0"
            placeholder="0.5"
            {...form.register("targetRateKg")}
          />
        </div>
      )}
    </div>
  );
}

function Step4Form({ form }: { form: ReturnType<typeof useForm<Step4Data>> }) {
  const selected = form.watch("dietType");
  const allergies = form.watch("allergies") ?? [];

  const toggleAllergy = (a: string) => {
    const current = allergies;
    form.setValue(
      "allergies",
      current.includes(a) ? current.filter((x) => x !== a) : [...current, a]
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="mb-3 block">Diet Type</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => form.setValue("dietType", opt.value as Step4Data["dietType"])}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${selected === opt.value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--primary)]/40"}`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Allergies / Exclusions (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergy(a)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${allergies.includes(a) ? "border-[var(--destructive)] bg-red-50 text-[var(--destructive)] dark:bg-red-950" : "border-[var(--border)] hover:border-[var(--muted-foreground)]"}`}
            >
              {allergies.includes(a) ? "✕ " : ""}{a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
