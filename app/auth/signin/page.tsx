import { Suspense } from "react";
import { SignInForm } from "./signin-form";

export const metadata = { title: "Sign in — NutriPlan" };

export default function SignInPage() {
  // Decided on the server so the Google button only appears when the provider is configured.
  const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    }>
      <SignInForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
