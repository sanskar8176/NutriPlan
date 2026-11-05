import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listPlansForUser } from "@/lib/plans";
import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard — NutriPlan" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=%2Fdashboard");

  const plans = await listPlansForUser(session.user.id);
  return <DashboardClient plans={plans} userName={session.user.name ?? "there"} />;
}
