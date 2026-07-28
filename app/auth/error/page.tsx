"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const messages: Record<string, string> = {
    Configuration: "Server configuration error. Please try again later.",
    AccessDenied: "Access denied. You may not have permission to sign in.",
    Verification: "The verification link has expired or already been used.",
    Default: "An error occurred during sign in. Please try again.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="font-heading text-2xl font-bold mb-2">Sign In Error</h1>
        <p className="text-[var(--muted-foreground)] mb-6">
          {messages[error ?? "Default"] ?? messages.Default}
        </p>
        <Link href="/auth/signin">
          <Button>Try Again</Button>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
