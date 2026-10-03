import "server-only";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { audit } from "./audit";
import { batches, batchItems, claimPayments, claims, db, ledgerEntries } from "./db";
import { TERMINAL } from "./payout-status";
import { formatMoney } from "./money";
import { computeObligations, moneyStatus, type LedgerKind, type Obligations } from "./settlement";

type Claim = typeof claims.$inferSelect;

export async function obligationsFor(claim: Claim): Promise<Obligations> {
  const [payments, ledger] = await Promise.all([
    db.select().from(claimPayments).where(eq(claimPayments.claimId, claim.id)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.claimId, claim.id)),
  ]);
  return computeObligations({ totalCents: claim.amountCents, payerUserId: claim.payerUserId, payments, ledger });
}

/** Statuses whose money state follows the ledger (after approval and batching). */
const SETTLING = ["matched", "in_batch", "partially_paid", "paid", "failed"];

/** Re-derives a settling claim's status from its balances. */
export async function syncMoneyStatus(claimId: string) {
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim || !SETTLING.includes(claim.status)) return claim;
  const m = moneyStatus(await obligationsFor(claim));
  // "unpaid" after having been paid means the payout bounced: owed again and batchable.
  const next =
    m === "paid" || m === "owes_back" || m === "nothing_owed" ? "paid" : m === "partially_paid" ? "partially_paid" : ["paid", "partially_paid"].includes(claim.status) ? "failed" : claim.status;
  if (next === claim.status) return claim;
  // While any payout for this claim is still in flight, it stays in its batch (never batchable twice).
  if (next !== "paid") {
    const inFlight = await db
      .select({ id: batchItems.id })
      .from(batchItems)
      .innerJoin(batches, eq(batches.id, batchItems.batchId))
      .where(and(eq(batchItems.claimId, claimId), notInArray(batchItems.status, [...TERMINAL]), ne(batches.status, "failed")));
    if (inFlight.length) return claim;
  }
  const [updated] = await db.update(claims).set({ status: next, updatedAt: new Date() }).where(eq(claims.id, claimId)).returning();
  return updated;
}

export async function recordLedger(
  workspaceId: string,
  actorId: string | null,
  entries: { claimId: string; userId: string; kind: LedgerKind; amountCents: number; currency: string; reference?: string | null; batchItemId?: string | null }[],
) {
  if (!entries.length) return;
  await db.insert(ledgerEntries).values(entries.map((e) => ({ ...e, workspaceId, createdBy: actorId })));
  for (const e of entries)
    await audit(workspaceId, actorId, `ledger.${e.kind}`, "claim", e.claimId, { amount: formatMoney(e.amountCents, e.currency), reference: e.reference ?? undefined });
  for (const id of new Set(entries.map((e) => e.claimId))) await syncMoneyStatus(id);
}

/** Balances for many claims at once (employee balance view, exception inbox). */
export async function obligationsForMany(rows: Claim[]) {
  if (!rows.length) return new Map<string, Obligations>();
  const ids = rows.map((r) => r.id);
  const [payments, ledger] = await Promise.all([
    db.select().from(claimPayments).where(inArray(claimPayments.claimId, ids)),
    db.select().from(ledgerEntries).where(and(inArray(ledgerEntries.claimId, ids))),
  ]);
  return new Map(
    rows.map((c) => [
      c.id,
      computeObligations({
        totalCents: c.amountCents,
        payerUserId: c.payerUserId,
        payments: payments.filter((p) => p.claimId === c.id),
        ledger: ledger.filter((l) => l.claimId === c.id),
      }),
    ]),
  );
}
