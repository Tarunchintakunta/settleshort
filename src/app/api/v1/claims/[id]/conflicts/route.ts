import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { openContradictions } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";

// A human accepts a disagreement between pieces of evidence, with a reason. Kept on the claim and in the audit log.
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const { key, note } = await body(req, z.object({ key: z.string().max(400), note: z.string().trim().min(3).max(500) }));
    const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
    if (!c) fail(404, "not_found", "Claim not found");
    const conflict = (await openContradictions(c!)).find((x) => x.key === key);
    if (!conflict) fail(404, "not_found", "That conflict is already resolved");
    const [updated] = await db
      .update(claims)
      .set({ acknowledgedConflicts: [...c!.acknowledgedConflicts, { key, by: ctx.user.id, note, at: new Date().toISOString() }], updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    await audit(ctx.workspace.id, ctx.user.id, "claim.contradiction_accepted", "claim", id, { conflict: conflict!.message, note });
    return updated;
  },
  { admin: true },
);
