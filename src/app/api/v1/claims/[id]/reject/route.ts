import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";

export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const { reason } = await body(req, z.object({ reason: z.string().max(500).optional() }));
    const [c] = await db
      .update(claims)
      .set({ status: "rejected", note: reason ? `Rejected: ${reason}` : undefined, updatedAt: new Date() })
      .where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id), inArray(claims.status, ["draft", "pending_review", "matched"])))
      .returning();
    if (!c) fail(409, "not_rejectable", "Claim not found or already in a batch");
    await audit(ctx.workspace.id, ctx.user.id, "claim.rejected", "claim", id, { reason });
    return c;
  },
  { admin: true },
);
