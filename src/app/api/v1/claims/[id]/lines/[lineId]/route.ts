import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { payeesOf } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claimLines, claims, db } from "@/lib/db";
import { approvalBlocker } from "@/lib/policy";

// Approve, hold or dispute one line. Undisputed lines can be paid while a disputed one stays visible and owed.
export const POST = route<{ id: string; lineId: string }>(async (req, ctx, { id, lineId }) => {
  const { state, note } = await body(req, z.object({ state: z.enum(["approved", "held", "disputed"]), note: z.string().trim().max(300).optional() }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!["pending_review", "matched", "partially_paid", "failed"].includes(c!.status)) fail(409, "locked", `Lines can't change while the claim is ${c!.status}`);
  const blocked = approvalBlocker({ id: ctx.user.id, role: ctx.role! }, { submitterId: c!.submitterId, payeeIds: (await payeesOf(c!)).map((p) => p.userId) }, ctx.workspace.alternateApproverId);
  if (blocked) fail(403, blocked.code, blocked.message);
  if (state !== "approved" && !note) fail(400, "note_required", "Say what's wrong with this line, so the claimant can fix it");
  const [line] = await db
    .update(claimLines)
    .set({ state, decisionNote: note ?? null, decidedBy: ctx.user.id, decidedAt: new Date() })
    .where(and(eq(claimLines.id, lineId), eq(claimLines.claimId, id)))
    .returning();
  if (!line) fail(404, "not_found", "Line not found");
  await audit(ctx.workspace.id, ctx.user.id, `claim.line_${state}`, "claim", id, { line: line!.name, note });
  return line;
});
