import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getClaimsByIds } from "@/lib/claims";
import { activeApproval, revalidateApproval } from "@/lib/approvals";
import { claimEvidence, claims, db } from "@/lib/db";

// Keeps the first id; the rest become rejected duplicates pointing at it.
export const POST = route(
  async (req, ctx) => {
    const { ids } = await body(req, z.object({ ids: z.array(z.string().uuid()).min(2).max(20) }));
    const rows = await getClaimsByIds(ctx.workspace.id, ids);
    if (rows.length !== ids.length) fail(404, "not_found", "Some claims were not found");
    if (rows.some((r) => !["draft", "pending_review", "matched"].includes(r.status))) fail(409, "locked", "Batched or paid claims cannot be merged");
    const [keep, ...dupes] = ids;
    await db
      .update(claims)
      .set({ status: "rejected", duplicateOfId: keep, updatedAt: new Date() })
      .where(and(eq(claims.workspaceId, ctx.workspace.id), inArray(claims.id, dupes)));
    // The duplicates' evidence joins the kept claim, so one claim tells the whole story (#1).
    await db.update(claimEvidence).set({ claimId: keep }).where(inArray(claimEvidence.claimId, dupes));
    await revalidateApproval(ctx.workspace.id, keep, ctx.user.id);
    // Merging resolves the duplicate flag; it is not an approval.
    const approved = await activeApproval(keep);
    await db.update(claims).set({ status: approved ? "matched" : "pending_review", duplicateOfId: null, updatedAt: new Date() }).where(eq(claims.id, keep));
    await audit(ctx.workspace.id, ctx.user.id, "claim.merged", "claim", keep, { merged: dupes.map((d) => `#${rows.find((r) => r.id === d)!.number}`) });
    return { keep };
  },
  { admin: true },
);
