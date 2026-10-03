import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { claims, db, ledgerEntries } from "@/lib/db";
import { obligationsFor, recordLedger } from "@/lib/ledger";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  return { obligations: await obligationsFor(c!), entries: await db.select().from(ledgerEntries).where(eq(ledgerEntries.claimId, id)) };
});

// Money that moved outside a PayPal batch: a manual partial repayment, a merchant refund, or money returned.
const Entry = z.object({
  kind: z.enum(["repayment", "refund", "clawback"]),
  userId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
  reference: z.string().trim().max(200).optional(),
});

export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
    if (!c) fail(404, "not_found", "Claim not found");
    if (c!.status === "in_batch") fail(409, "in_batch", "This claim is in a payout batch. Record money after the batch settles.");
    if (!["matched", "partially_paid", "paid", "failed"].includes(c!.status)) fail(409, "not_approved", "Approve the claim before recording money against it");
    const e = await body(req, Entry);
    const p = (await obligationsFor(c!)).payees.find((x) => x.userId === e.userId);
    if (!p) fail(400, "not_payee", "That person isn't owed anything on this claim");
    if (e.kind === "repayment" && e.amountCents > p!.outstandingCents) fail(400, "over_repayment", "That's more than is still owed");
    if (e.kind === "clawback" && e.amountCents > -p!.outstandingCents) fail(400, "over_clawback", "That's more than they owe back");
    await recordLedger(ctx.workspace.id, ctx.user.id, [{ claimId: id, userId: e.userId, kind: e.kind, amountCents: e.amountCents, currency: c!.currency, reference: e.reference }]);
    const [updated] = await db.select().from(claims).where(eq(claims.id, id));
    return { claim: updated, obligations: await obligationsFor(updated) };
  },
  { admin: true },
);
