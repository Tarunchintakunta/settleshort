import "server-only";
import { and, eq, gt, inArray, ne, or } from "drizzle-orm";
import { claimPayments, claims, db, delegations, ledgerEntries, workspaces } from "./db";
import { saasFindings } from "./exceptions";
import { obligationsForMany } from "./ledger";

/** Everything still open with a person who is leaving: money both ways, their claims, approvals, subscriptions. */
export async function offboardingReport(ws: typeof workspaces.$inferSelect, userId: string) {
  const linked = await Promise.all([
    db.select({ id: claimPayments.claimId }).from(claimPayments).where(eq(claimPayments.userId, userId)),
    db.select({ id: ledgerEntries.claimId }).from(ledgerEntries).where(and(eq(ledgerEntries.workspaceId, ws.id), eq(ledgerEntries.userId, userId))),
  ]);
  const extra = [...new Set(linked.flat().map((r) => r.id))];
  const rows = await db
    .select()
    .from(claims)
    .where(and(eq(claims.workspaceId, ws.id), ne(claims.status, "rejected"), or(eq(claims.payerUserId, userId), eq(claims.submitterId, userId), eq(claims.escalatedToUserId, userId), eq(claims.budgetOwnerUserId, userId), extra.length ? inArray(claims.id, extra) : undefined)));
  const owed = await obligationsForMany(rows);
  const mine = rows.map((c) => ({ c, p: owed.get(c.id)!.payees.find((x) => x.userId === userId) }));
  const [saas, dels] = await Promise.all([
    saasFindings(ws.id),
    db.select().from(delegations).where(and(eq(delegations.workspaceId, ws.id), gt(delegations.endsAt, new Date()), or(eq(delegations.fromUserId, userId), eq(delegations.toUserId, userId)))),
  ]);
  return {
    owedToThem: mine.filter((m) => m.p && m.p.outstandingCents > 0 && m.c.status !== "pending_review").map((m) => ({ claim: m.c, cents: m.p!.outstandingCents })),
    owedByThem: mine.filter((m) => m.p && m.p.outstandingCents < 0).map((m) => ({ claim: m.c, cents: -m.p!.outstandingCents })),
    openClaims: rows.filter((c) => c.submitterId === userId && ["draft", "pending_review"].includes(c.status)),
    waitingOnThem: rows.filter((c) => (c.escalatedToUserId === userId || c.budgetOwnerUserId === userId) && c.status === "pending_review"),
    subscriptions: saas.personal.filter((s) => s.payerUserId === userId),
    delegations: dels,
  };
}
