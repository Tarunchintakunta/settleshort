import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, db, fixRequests } from "@/lib/db";

// The claimant answers a fix request (after fixing the claim) or the requester withdraws it.
export const POST = route<{ id: string; rid: string }>(async (req, ctx, { id, rid }) => {
  const { reply } = await body(req, z.object({ reply: z.string().trim().min(2).max(300) }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  const [r] = await db.select().from(fixRequests).where(and(eq(fixRequests.id, rid), eq(fixRequests.claimId, id), isNull(fixRequests.resolvedAt)));
  if (!r) fail(404, "not_found", "Request not found or already resolved");
  if (![c!.submitterId, c!.payerUserId, r!.requestedBy].includes(ctx.user.id)) fail(403, "forbidden", "Only the claimant or the requester can close this");
  await db.update(fixRequests).set({ reply, resolvedBy: ctx.user.id, resolvedAt: new Date() }).where(eq(fixRequests.id, rid));
  await audit(ctx.workspace.id, ctx.user.id, "claim.fix_resolved", "claim", id, { field: r!.field, reply });
  return { ok: true };
});
