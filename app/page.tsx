import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Zap, Target, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/index";
import { HeroAnimation } from "@/components/three/hero-animation";

const features = [
  {
    icon: Zap,
    title: "Science-Backed Calculations",
    description: "Mifflin-St Jeor BMR formula + activity multipliers give you a precise calorie target — not a generic guess.",
  },
  {
    icon: Target,
    title: "Goal-Specific Macro Splits",
    description: "Whether you're cutting, bulking, or maintaining, your protein/carb/fat ratios are optimized for your goal.",
  },
  {
    icon: BarChart3,
    title: "Visual Nutrition Dashboard",
    description: "Interactive charts break down your macros at a glance. See exactly where your calories come from.",
  },
  {
    icon: ShieldCheck,
    title: "Diet-Preference Aware",
    description: "Vegan, keto, vegetarian, or non-veg — your meal plan respects your dietary choices and allergies.",
  },
];

const stats = [
  { value: "98%", label: "Accuracy vs. lab-measured BMR" },
  { value: "4", label: "Diet types supported" },
  { value: "20+", label: "Curated meal options" },
  { value: "Free", label: "Forever, no credit card" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--primary)]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-foreground)]">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
              Free · No account required to start
            </div>

            <h1 className="font-heading text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight">
              Your body.
              <br />
              <span className="text-[var(--primary)]">Your plan.</span>
              <br />
              Your results.
            </h1>

            <p className="text-lg text-[var(--muted-foreground)] max-w-md leading-relaxed">
              Enter your stats, pick your goal, and get a personalized calorie target, macro breakdown, and full meal plan — in under 2 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/plan">
                <Button size="xl" className="group w-full sm:w-auto">
                  Build My Plan
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/#features">
                <Button size="xl" variant="outline" className="w-full sm:w-auto">
                  How it works
                </Button>
              </Link>
            </div>
          </div>

          {/* 3D / animated hero visual */}
          <div className="hidden lg:flex items-center justify-center h-[480px]">
            <HeroAnimation />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[var(--border)] bg-[var(--secondary)]/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-3xl font-extrabold text-[var(--primary)]">{s.value}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="font-heading text-4xl font-bold mb-4">Everything you need to eat right</h2>
          <p className="text-[var(--muted-foreground)] text-lg max-w-xl mx-auto">
            No guesswork. No generic advice. Just a plan built around your numbers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="group hover:shadow-lg hover:border-[var(--primary)]/40 transition-all duration-300">
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <f.icon className="h-6 w-6 text-[var(--primary)]" />
                </div>
                <h3 className="font-heading font-semibold text-base">{f.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--secondary)]/30 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-heading text-4xl font-bold mb-4">Ready in 4 steps</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Enter your stats", desc: "Age, height, weight, gender — takes 30 seconds." },
              { step: "02", title: "Set your activity", desc: "From desk job to daily athlete — we adjust your TDEE." },
              { step: "03", title: "Choose your goal", desc: "Lose fat, build muscle, or maintain your current weight." },
              { step: "04", title: "Get your plan", desc: "Instant calorie target, macros, and a full meal plan." },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <span className="font-heading text-5xl font-extrabold text-[var(--primary)]/20">{item.step}</span>
                <h3 className="font-heading font-semibold text-lg">{item.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meal preview */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="font-heading text-4xl font-bold mb-4">Real food. Real meals.</h2>
          <p className="text-[var(--muted-foreground)] text-lg">Curated meals with accurate nutrition data — not generic filler.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { name: "Grilled Salmon & Veggies", cal: 580, tag: "Dinner", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80" },
            { name: "Quinoa Power Bowl", cal: 480, tag: "Lunch", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80" },
            { name: "Oatmeal with Berries", cal: 320, tag: "Breakfast", img: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=600&q=80" },
          ].map((meal) => (
            <Card key={meal.name} className="overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={meal.img}
                  alt={meal.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute top-3 left-3">
                  <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-white">
                    {meal.tag}
                  </span>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold">{meal.name}</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">{meal.cal} kcal per serving</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--primary)] py-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-heading text-4xl font-extrabold text-white mb-4">
            Start eating smarter today
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Free forever. No credit card. No fluff — just your personalized plan.
          </p>
          <Link href="/plan">
            <Button size="xl" variant="secondary" className="group">
              Build My Plan Free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--muted-foreground)]">
          <span>© 2025 NutriPlan. Built with Next.js & ❤️</span>
          <span>
            Food photos by{" "}
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--foreground)]">
              Unsplash
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
