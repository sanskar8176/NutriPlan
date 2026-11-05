"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Card, CardContent, Separator } from "@/components/ui/index";
import Link from "next/link";
import { safeRedirectPath } from "@/lib/utils";

const MIN_PASSWORD = 8;

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-origin paths are honoured — a crafted callbackUrl can never send the user off-site.
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"), "/dashboard");

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

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? (res.status === 429 ? "Too many attempts. Please wait a few minutes." : "Registration failed"));
          return;
        }
      }

      const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
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
            {googleEnabled && (
              <>
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
              </>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name" className="mb-1.5 block">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={100}
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
                  autoComplete="email"
                  maxLength={254}
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
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? MIN_PASSWORD : 1}
                  maxLength={72}
                />
                {mode === "signup" && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">At least {MIN_PASSWORD} characters.</p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm text-[var(--destructive)] bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
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
                type="button"
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
