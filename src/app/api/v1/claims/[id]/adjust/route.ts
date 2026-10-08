import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { approveClaim, payeesOf } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { approvalBlocker } from "@/lib/policy";

const REASON = { personal: "Personal item", over_policy: "Over policy", missing_receipt: "No receipt for part of it", duplicate_item: "Already claimed", other: "Other" } as const;

// Adjust-and-approve: approve a lower amount with a reason code the claimant sees (blueprint E4).
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { approvedCents, reasonCode, note, riskAcknowledged, riskNote } = await body(
    req,
    z.object({
      approvedCents: z.number().int().min(0),
      reasonCode: z.enum(Object.keys(REASON) as [keyof typeof REASON]),
      note: z.string().trim().min(3).max(300),
      riskAcknowledged: z.boolean().optional(),
      riskNote: z.string().trim().max(500).optional(),
    }),
  );
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (c!.status !== "pending_review") fail(409, "locked", "Only claims waiting for approval can be adjusted");
  const blocked = approvalBlocker({ id: ctx.user.id, role: ctx.role! }, { submitterId: c!.submitterId, payeeIds: (await payeesOf(c!)).map((p) => p.userId) }, ctx.workspace.alternateApproverId);
  if (blocked) fail(403, blocked.code, blocked.message);
  if (approvedCents >= c!.amountCents) fail(400, "not_lower", "Adjust means approving less than the claim; use Approve for the full amount");
  const adjustmentCents = c!.amountCents - approvedCents;
  const adjustmentReason = `${REASON[reasonCode]}: ${note}`;
  await db.update(claims).set({ adjustmentCents, adjustmentReason, updatedAt: new Date() }).where(eq(claims.id, id));
  try {
    const approved = await approveClaim(ctx.workspace, { id: ctx.user.id, role: ctx.role! }, id, { riskAcknowledged, riskNote });
    await audit(ctx.workspace.id, ctx.user.id, "claim.adjusted", "claim", id, { approved: formatMoney(approvedCents, c!.currency), reduced_by: formatMoney(adjustmentCents, c!.currency), reason: adjustmentReason });
    return approved;
  } catch (e) {
    // Adjust and approve are one decision: if approval is blocked, the adjustment doesn't stick either.
    await db.update(claims).set({ adjustmentCents: c!.adjustmentCents, adjustmentReason: c!.adjustmentReason }).where(eq(claims.id, id));
    throw e;
  }
});
