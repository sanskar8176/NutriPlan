import { Suspense } from "react";
import { ResultsDashboard } from "./results-dashboard";

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Calculating your plan…</p>
        </div>
      </div>
    }>
      <ResultsDashboard />
    </Suspense>
  );
}
