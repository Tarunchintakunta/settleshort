import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";

// The submitter takes back their own claim while nobody has paid it. Kept as a rejected claim with the reason, never deleted.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { reason } = await body(req, z.object({ reason: z.string().trim().min(3).max(500) }));
  const [c] = await db
    .update(claims)
    .set({ status: "rejected", note: `Withdrawn: ${reason}`, updatedAt: new Date() })
    .where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id), eq(claims.submitterId, ctx.user.id), inArray(claims.status, ["draft", "pending_review", "matched"])))
    .returning();
  if (!c) fail(409, "not_withdrawable", "Only your own claims can be withdrawn, and only before they go into a batch");
  await audit(ctx.workspace.id, ctx.user.id, "claim.withdrawn", "claim", id, { reason });
  return c;
});
