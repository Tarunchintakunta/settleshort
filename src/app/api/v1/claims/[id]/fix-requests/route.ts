import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { payeesOf } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claims, db, fixRequests } from "@/lib/db";
import { approvalBlocker } from "@/lib/policy";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) =>
  db.select().from(fixRequests).where(and(eq(fixRequests.claimId, id), eq(fixRequests.workspaceId, ctx.workspace.id))),
);

// An approver asks for exactly what's missing. The claim keeps everything else; approval waits for the fix.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const { field, message } = await body(req, z.object({ field: z.enum(["attendees", "receipt", "purpose", "amount", "date", "merchant", "other"]), message: z.string().trim().min(3).max(300) }));
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (c!.status !== "pending_review") fail(409, "locked", "Fixes can be requested while a claim waits for approval");
  const blocked = approvalBlocker({ id: ctx.user.id, role: ctx.role! }, { submitterId: c!.submitterId, payeeIds: (await payeesOf(c!)).map((p) => p.userId) }, ctx.workspace.alternateApproverId);
  if (blocked) fail(403, blocked.code, blocked.message);
  const [row] = await db.insert(fixRequests).values({ workspaceId: ctx.workspace.id, claimId: id, field, message, requestedBy: ctx.user.id }).returning();
  await audit(ctx.workspace.id, ctx.user.id, "claim.fix_requested", "claim", id, { field, message });
  return row;
});
