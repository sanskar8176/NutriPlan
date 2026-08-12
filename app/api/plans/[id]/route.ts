import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DEV = process.env.NODE_ENV === "development";
function dbLog(op: string, ...args: unknown[]) {
  if (!DEV) return;
  console.log(`\n\x1b[35m[NutriPlan:DB:${op}]\x1b[0m`, ...args);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  dbLog("Plan:FindUnique", `id=${id}`);
  const plan = await prisma.plan.findUnique({ where: { id } });

  if (!plan || plan.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  dbLog("Plan:Delete", `id=${id}`);
  await prisma.plan.delete({ where: { id } });
  dbLog("Plan:Delete:OK", `id=${id}`);
  return NextResponse.json({ ok: true });
}
