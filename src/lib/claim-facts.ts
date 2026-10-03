import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { LOW_CONFIDENCE } from "./claims";
import { approvals, batches, batchItems, claimEvidence, claims, db, ledgerEntries } from "./db";
import { obligationsForMany } from "./ledger";
import { moneyStatus } from "./settlement";
import { findContradictions, uncertainFields, type EvidenceFacts } from "./evidence";
import { truthfulStatus, type ClaimFacts } from "./status";

type Claim = typeof claims.$inferSelect;

/** Everything needed for the truthful status and timeline of many claims, in a fixed number of queries. */
export async function factsFor(rows: Claim[]) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Map<string, { facts: ClaimFacts; truth: ReturnType<typeof truthfulStatus> }>();
  const [owed, appr, items, payouts, evidence] = await Promise.all([
    obligationsForMany(rows),
    db.select().from(approvals).where(and(inArray(approvals.claimId, ids), isNull(approvals.invalidatedAt))),
    db.select({ item: batchItems, batch: batches }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(inArray(batchItems.claimId, ids)).orderBy(desc(batches.createdAt)),
    db.select().from(ledgerEntries).where(and(inArray(ledgerEntries.claimId, ids), eq(ledgerEntries.kind, "payout"))).orderBy(desc(ledgerEntries.createdAt)),
    db.select().from(claimEvidence).where(inArray(claimEvidence.claimId, ids)).orderBy(claimEvidence.createdAt),
  ]);
  return new Map(
    rows.map((c) => {
      const mine = items.filter((i) => i.item.claimId === c.id);
      const latest = mine[0]?.batch ?? null;
      const latestItems = mine.filter((i) => i.batch.id === latest?.id).map((i) => i.item);
      const facts: ClaimFacts = {
        status: c.status,
        flagged:
          !!c.duplicateOfId ||
          (c.aiConfidence != null && c.aiConfidence < LOW_CONFIDENCE) ||
          uncertainFields((c.aiJson as { field_confidence?: Record<string, number> } | null)?.field_confidence).length > 0 ||
          findContradictions(evidence.filter((e) => e.claimId === c.id).map((e) => ({ id: e.id, kind: e.kind, extract: e.extractJson as EvidenceFacts["extract"] }))).some(
            (x) => !c.acknowledgedConflicts.some((a) => a.key === x.key),
          ),
        createdAt: c.createdAt,
        approvedAt: appr.find((a) => a.claimId === c.id)?.createdAt ?? null,
        batch: latest ? { status: latest.status, createdAt: latest.createdAt, sentAt: latest.paypalPayoutBatchId ? latest.approvedAt : null } : null,
        itemStatuses: latestItems.map((i) => i.status),
        paidAt: payouts.find((p) => p.claimId === c.id)?.createdAt ?? null,
        confirmedAt: latestItems.length && latestItems.every((i) => i.confirmedAt) ? latestItems[0].confirmedAt : null,
        notReceivedAt: latestItems.find((i) => i.notReceivedAt)?.notReceivedAt ?? null,
        money: moneyStatus(owed.get(c.id)!),
      };
      return [c.id, { facts, truth: truthfulStatus(facts) }];
    }),
  );
}
