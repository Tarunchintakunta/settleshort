import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claimEvidence, claims, db } from "@/lib/db";
import { redactStatement } from "@/lib/evidence";

// Payment proof from a personal statement: only the chosen lines are stored; the rest never leave the browser request.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { lines, keep } = await body(req, z.object({ lines: z.array(z.string().max(300)).min(1).max(200), keep: z.array(z.number().int().min(0)).min(1).max(50) }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (![c!.submitterId, c!.payerUserId].includes(ctx.user.id)) fail(403, "forbidden", "Only the person who paid can share their statement");
  if (["paid", "rejected"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status}`);
  const r = redactStatement(lines, keep);
  if (!r.keptCount) fail(400, "nothing_kept", "Choose at least one line that shows the payment");
  await db.insert(claimEvidence).values({
    workspaceId: ctx.workspace.id,
    claimId: id,
    kind: "statement",
    source: "manual",
    rawText: r.text,
    redactedCount: r.redactedCount,
    extractJson: { statement_lines: r.keptCount, redacted_lines: r.redactedCount },
    addedBy: ctx.user.id,
  });
  await audit(ctx.workspace.id, ctx.user.id, "claim.statement_shared", "claim", id, { kept: r.keptCount, redacted: r.redactedCount });
  return revalidateApproval(ctx.workspace.id, id, ctx.user.id);
});
