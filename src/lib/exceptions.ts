import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { releaseProblems } from "./approvals";
import { factsFor } from "./claim-facts";
import { batches, batchItems, claimEvidence, claims, db, workspaces } from "./db";
import { formatMoney } from "./money";

export type Exception = {
  key: string;
  kind: "stuck" | "conflict" | "large" | "payout";
  title: string;
  why: string;
  action: string;
  href: string;
  at: Date;
};

const DAY = 86_400_000;
export const STUCK_AFTER_DAYS = 2;

/** Only what needs a decision: stuck, conflicting, unusually large or uncertain. Routine updates stay out. */
export async function workspaceExceptions(ws: typeof workspaces.$inferSelect): Promise<Exception[]> {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_DAYS * DAY);
  const [open, batchRows, missing, declared] = await Promise.all([
    db.select().from(claims).where(and(eq(claims.workspaceId, ws.id), inArray(claims.status, ["pending_review", "matched", "in_batch", "failed", "partially_paid", "paid"]))),
    db.select().from(batches).where(and(eq(batches.workspaceId, ws.id), inArray(batches.status, ["awaiting_approval", "unknown", "partial", "failed"]))),
    db
      .select({ item: batchItems })
      .from(batchItems)
      .innerJoin(batches, eq(batches.id, batchItems.batchId))
      .where(and(eq(batches.workspaceId, ws.id), isNotNull(batchItems.notReceivedAt))),
    db.select({ claimId: claimEvidence.claimId }).from(claimEvidence).where(and(eq(claimEvidence.workspaceId, ws.id), eq(claimEvidence.kind, "declaration"))),
  ]);
  const facts = await factsFor(open);
  const out: Exception[] = [];
  const claimLink = (c: typeof claims.$inferSelect) => `/app/claims/${c.id}`;
  const label = (c: typeof claims.$inferSelect) => `#${c.number} ${c.vendor || "Untitled"} · ${formatMoney(c.amountCents, c.currency)}`;

  for (const c of open) {
    const f = facts.get(c.id)!;
    if (c.status === "pending_review" && c.duplicateOfId)
      out.push({ key: `dup-${c.id}`, kind: "conflict", title: label(c), why: "Looks like a duplicate of another claim.", action: "Merge it or approve it as separate", href: claimLink(c), at: c.updatedAt });
    else if (c.status === "pending_review" && c.createdAt < stuckBefore)
      out.push({ key: `stuck-${c.id}`, kind: "stuck", title: label(c), why: `Waiting for approval for over ${STUCK_AFTER_DAYS} days.`, action: "Approve or reject it", href: claimLink(c), at: c.createdAt });
    if (c.amountCents > ws.maxSingleCents && !["paid", "rejected"].includes(c.status))
      out.push({ key: `large-${c.id}`, kind: "large", title: label(c), why: `Above the ${formatMoney(ws.maxSingleCents, c.currency)} single-payout cap.`, action: "Check it, or raise the cap in Settings", href: claimLink(c), at: c.createdAt });
    if (c.status === "pending_review" && declared.some((d) => d.claimId === c.id))
      out.push({ key: `declared-${c.id}`, kind: "conflict", title: label(c), why: "No receipt: the payer signed a missing-receipt declaration.", action: "Read the declaration before approving", href: claimLink(c), at: c.updatedAt });
    if (c.kind === "deposit" && c.depositStatus === "held" && c.createdAt.getTime() < Date.now() - 30 * DAY)
      out.push({ key: `deposit-${c.id}`, kind: "stuck", title: label(c), why: "Refundable deposit still held after 30 days.", action: "Chase the refund or mark it used up", href: claimLink(c), at: c.createdAt });
    if (c.recoveryStatus === "to_invoice" && c.createdAt.getTime() < Date.now() - 7 * DAY)
      out.push({ key: `recover-${c.id}`, kind: "stuck", title: label(c), why: `Should be billed to ${c.recoverableClient} and hasn't been invoiced.`, action: "Invoice the client", href: claimLink(c), at: c.createdAt });
    if (c.status === "failed") out.push({ key: `failed-${c.id}`, kind: "payout", title: label(c), why: "PayPal couldn't pay it.", action: "Fix the receiver's PayPal email, then batch it again", href: claimLink(c), at: c.updatedAt });
    if (f.truth.key === "owes_back") out.push({ key: `back-${c.id}`, kind: "conflict", title: label(c), why: "A refund arrived after reimbursement.", action: "Record the money returned", href: claimLink(c), at: c.updatedAt });
    if (f.truth.key === "unclaimed") out.push({ key: `unclaimed-${c.id}`, kind: "payout", title: label(c), why: "The receiver hasn't accepted the PayPal payout.", action: "Ask them to accept it in PayPal", href: claimLink(c), at: c.updatedAt });
  }

  const inBatch = open.filter((c) => c.status === "in_batch");
  for (const p of await releaseProblems(ws.id, inBatch.map((c) => c.id))) {
    const c = inBatch.find((x) => x.id === p.claimId)!;
    out.push({ key: `changed-${c.id}`, kind: "conflict", title: label(c), why: `Changed since approval: ${p.problems.join("; ")}.`, action: "Re-approve it before release", href: claimLink(c), at: c.updatedAt });
  }

  for (const b of batchRows) {
    const href = `/app/batches/${b.id}`;
    const t = `${b.name} · ${formatMoney(b.totalCents, b.currency)}`;
    if (b.status === "unknown") out.push({ key: `unknown-${b.id}`, kind: "payout", title: t, why: "PayPal didn't answer; nothing will be resent.", action: "Verify with PayPal", href, at: b.approvedAt ?? b.createdAt });
    if (b.status === "awaiting_approval" && b.createdAt < stuckBefore)
      out.push({ key: `release-${b.id}`, kind: "stuck", title: t, why: `Waiting for release for over ${STUCK_AFTER_DAYS} days.`, action: "Release or adjust the batch", href, at: b.createdAt });
    if (b.status === "partial" || b.status === "failed") out.push({ key: `batchfail-${b.id}`, kind: "payout", title: t, why: b.status === "partial" ? "Some payouts failed." : "The payout failed.", action: "Open the batch", href, at: b.approvedAt ?? b.createdAt });
  }

  for (const { item } of missing) {
    const c = open.find((x) => x.id === item.claimId);
    out.push({
      key: `missing-${item.id}`,
      kind: "payout",
      title: `${item.receiverName} · ${formatMoney(item.amountCents, item.currency)}`,
      why: "PayPal says paid, but the receiver reports the money missing.",
      action: "Check the PayPal transaction and reply to them",
      href: c ? claimLink(c) : "/app/batches",
      at: item.notReceivedAt!,
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
