import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, claimSplits, db, memberships } from "@/lib/db";
import { splitEven } from "@/lib/money";

// Who attended or benefited, and whose budget covers it. Neither changes who gets reimbursed.
export const PUT = route<{ id: string }>(async (req, ctx, { id }) => {
  const { participantIds, budgetOwnerUserId } = await body(
    req,
    z.object({ participantIds: z.array(z.string().uuid()).max(50).optional(), budgetOwnerUserId: z.string().uuid().nullable().optional() }),
  );
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");
  const ids = [...new Set([...(participantIds ?? []), ...(budgetOwnerUserId ? [budgetOwnerUserId] : [])])];
  if (ids.length) {
    const ok = await db.select({ u: memberships.userId }).from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), inArray(memberships.userId, ids)));
    if (ok.length !== ids.length) fail(400, "not_member", "Everyone must be a workspace member");
  }
  if (participantIds) {
    await db.delete(claimSplits).where(eq(claimSplits.claimId, id));
    const parts = splitEven(c!.amountCents, participantIds.length || 1);
    if (participantIds.length)
      await db.insert(claimSplits).values(participantIds.map((userId, i) => ({ claimId: id, userId, amountCents: parts[i], shareBps: Math.round(10000 / participantIds.length) })));
  }
  if (budgetOwnerUserId !== undefined) await db.update(claims).set({ budgetOwnerUserId, updatedAt: new Date() }).where(eq(claims.id, id));
  await audit(ctx.workspace.id, ctx.user.id, "claim.people_set", "claim", id, { participants: participantIds?.length, budget_owner: budgetOwnerUserId });
  return { ok: true };
});
