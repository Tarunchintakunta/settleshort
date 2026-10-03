import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { advances, claimPayments, claims, db, memberships } from "@/lib/db";
import { FUNDING_SOURCES, paymentsProblem } from "@/lib/settlement";

const Payments = z.object({
  payments: z
    .array(z.object({ userId: z.string().uuid().nullable(), source: z.enum(FUNDING_SOURCES), amountCents: z.number().int().positive().max(100_000_000), advanceId: z.string().uuid().nullable().optional() }))
    .max(20),
});

// Replaces who funded the claim. Empty list = the single payer funded all of it.
export const PUT = route<{ id: string }>(async (req, ctx, { id }) => {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!["draft", "pending_review", "matched"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status} and can no longer be edited`);
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");
  const { payments } = await body(req, Payments);
  const rows = payments.map((p) => ({ ...p, userId: p.source === "employee" ? p.userId : null, advanceId: p.source === "advance" ? (p.advanceId ?? null) : null }));
  const advIds = rows.flatMap((p) => (p.advanceId ? [p.advanceId] : []));
  if (advIds.length) {
    const ok = await db.select().from(advances).where(and(eq(advances.workspaceId, ctx.workspace.id), inArray(advances.id, advIds), eq(advances.status, "open"), eq(advances.currency, c!.currency)));
    if (ok.length !== new Set(advIds).size) fail(400, "bad_advance", "Pick an open advance in the claim's currency");
  }
  const problem = paymentsProblem(c!.amountCents, rows);
  if (problem) fail(400, "invalid_payments", problem);
  const userIds = [...new Set(rows.flatMap((p) => (p.userId ? [p.userId] : [])))];
  if (userIds.length) {
    const ok = await db.select({ u: memberships.userId }).from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), inArray(memberships.userId, userIds)));
    if (ok.length !== userIds.length) fail(400, "not_member", "Every payer must be a workspace member");
  }
  await db.delete(claimPayments).where(eq(claimPayments.claimId, id));
  if (rows.length) await db.insert(claimPayments).values(rows.map((p) => ({ ...p, claimId: id })));
  await audit(ctx.workspace.id, ctx.user.id, "claim.payments_set", "claim", id, { payments: rows.length });
  return revalidateApproval(ctx.workspace.id, id, ctx.user.id);
});
