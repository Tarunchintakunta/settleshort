import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { runMatching, workspaceMembers } from "@/lib/claims";
import { parseCorrection } from "@/lib/corrections";
import { claimEvidence, claimPayments, claims, db } from "@/lib/db";

// "Actually, Maya paid": applies only the corrected fields and keeps the original story as evidence.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { text } = await body(req, z.object({ text: z.string().trim().min(3).max(500) }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!["draft", "pending_review", "matched"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status} and can no longer be corrected`);
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only correct your own claims");

  const members = await workspaceMembers(ctx.workspace.id);
  const fix = parseCorrection(text, members, new Date().toISOString().slice(0, 10));
  if (fix.payerUserId && (await db.select().from(claimPayments).where(eq(claimPayments.claimId, id))).length)
    fail(409, "several_payers", "This claim has several payers. Change them under 'Split who paid' instead.");
  const changes = Object.fromEntries(Object.entries(fix).filter(([k, v]) => v !== c![k as keyof typeof c]));
  if (!Object.keys(changes).length) fail(422, "nothing_to_change", "Couldn't tell what to change. Try \"Actually, Maya paid\" or \"it was $72.40\".");

  const from = Object.fromEntries(Object.keys(changes).map((k) => [k, c![k as keyof typeof c]]));
  await db.update(claims).set({ ...changes, updatedAt: new Date() }).where(eq(claims.id, id));
  // The correction is evidence too: the original message stays, and this one records what changed and why.
  await db.insert(claimEvidence).values({
    workspaceId: ctx.workspace.id,
    claimId: id,
    kind: "message",
    source: "manual",
    rawText: text,
    extractJson: { correction: true, from, to: changes },
    addedBy: ctx.user.id,
  });
  await audit(ctx.workspace.id, ctx.user.id, "claim.corrected", "claim", id, { text, from, to: changes });
  await revalidateApproval(ctx.workspace.id, id, ctx.user.id);
  return runMatching(ctx.workspace.id, id);
});
