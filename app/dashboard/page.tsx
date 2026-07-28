import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return <DashboardClient plans={plans} userName={session.user.name ?? "there"} />;
}
