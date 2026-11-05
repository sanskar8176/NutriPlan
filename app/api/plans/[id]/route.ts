import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deletePlanForUser } from "@/lib/plans";
import { jsonError, internalError } from "@/lib/http";

/** DELETE /api/plans/:id — delete one of the caller's plans. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/plans/[id]">) {
  const session = await auth();
  if (!session?.user?.id) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;
  if (!id || id.length > 64) return jsonError("Invalid plan id", 400);

  try {
    // Scoped delete: a plan that exists but belongs to someone else is indistinguishable from a missing one.
    const deleted = await deletePlanForUser(id, session.user.id);
    if (!deleted) return jsonError("Not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError("plans:delete", err);
  }
}
