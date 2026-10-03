import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, delegations } from "@/lib/db";

// End cover early. Only the person who delegated (or an admin) can.
export const DELETE = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [d] = await db.select().from(delegations).where(and(eq(delegations.id, id), eq(delegations.workspaceId, ctx.workspace.id)));
  if (!d) fail(404, "not_found", "Delegation not found");
  if (d!.fromUserId !== ctx.user.id && !ctx.isAdmin) fail(403, "forbidden", "Only the person who delegated can end it");
  await db.update(delegations).set({ endsAt: new Date() }).where(eq(delegations.id, id));
  await audit(ctx.workspace.id, ctx.user.id, "delegation.ended", "delegation", id, {});
  return { ok: true };
});
