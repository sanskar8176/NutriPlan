"use client";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Card, CardContent, Separator } from "@/components/ui/index";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--background)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-heading font-bold text-2xl mb-2">
            <Leaf className="h-7 w-7 text-[var(--primary)]" />
            NutriPlan
          </Link>
          <p className="text-[var(--muted-foreground)] text-sm">
            {mode === "signin" ? "Welcome back" : "Create your free account"}
          </p>
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <Button
              variant="outline"
              className="w-full mb-4"
              onClick={() => signIn("google", { callbackUrl })}
            >
              <Globe className="h-4 w-4" />
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 mb-4">
              <Separator className="flex-1" />
              <span className="text-xs text-[var(--muted-foreground)]">or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name" className="mb-1.5 block">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email" className="mb-1.5 block">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="mb-1.5 block">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--muted-foreground)] mt-4">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
                className="text-[var(--primary)] font-medium hover:underline"
              >
                {mode === "signin" ? "Sign up free" : "Sign in"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
