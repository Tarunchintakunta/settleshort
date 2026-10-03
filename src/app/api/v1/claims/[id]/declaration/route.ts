import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claimEvidence, claims, db } from "@/lib/db";

// An honest missing-receipt declaration, signed by the person who paid. Clearly labelled; never passed off as a receipt.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { reason, signedName } = await body(req, z.object({ reason: z.string().trim().min(10).max(500), signedName: z.string().trim().min(2).max(120) }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (![c!.submitterId, c!.payerUserId].includes(ctx.user.id)) fail(403, "forbidden", "Only the person who paid or submitted can declare a missing receipt");
  if (!["draft", "pending_review", "matched"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status}`);
  if (signedName.toLowerCase() !== ctx.user.name.toLowerCase()) fail(400, "signature", `Sign with your full name (${ctx.user.name})`);
  const text = `I declare the receipt for this ${c!.vendor || "expense"} is missing. Reason: ${reason}. Signed, ${signedName}.`;
  await db.insert(claimEvidence).values({ workspaceId: ctx.workspace.id, claimId: id, kind: "declaration", source: "manual", rawText: text, extractJson: { declaration: true, reason, signedName, signedAt: new Date().toISOString() }, addedBy: ctx.user.id });
  await audit(ctx.workspace.id, ctx.user.id, "claim.receipt_declared_missing", "claim", id, { reason });
  return revalidateApproval(ctx.workspace.id, id, ctx.user.id);
});
