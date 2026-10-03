import "server-only";
import { eq, inArray } from "drizzle-orm";
import { factsFor } from "./claim-facts";
import { workspaceMembers } from "./claims";
import { approvals, batches, batchItems, claimEvidence, claims, db, investigations } from "./db";
import { findContradictions, type EvidenceFacts } from "./evidence";
import { obligationsForMany } from "./ledger";
import { centsToDecimal } from "./money";

/** Claims in a date range (by expense date, else created date), oldest first. */
export async function claimsInRange(workspaceId: string, from: string, to: string) {
  const rows = await db.select().from(claims).where(eq(claims.workspaceId, workspaceId));
  const day = (c: (typeof rows)[number]) => c.txnDate ?? c.createdAt.toISOString().slice(0, 10);
  return rows.filter((c) => day(c) >= from && day(c) <= to).sort((a, b) => a.number - b.number);
}

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** One row per claim with everything an accountant asks for: category, approvals, adjustments, payouts, open exceptions. */
export async function evidencePackCsv(workspaceId: string, from: string, to: string, appUrl: string) {
  const rows = await claimsInRange(workspaceId, from, to);
  const ids = rows.map((r) => r.id);
  const [members, owed, facts, appr, items, ev, inv] = await Promise.all([
    workspaceMembers(workspaceId),
    obligationsForMany(rows),
    factsFor(rows),
    ids.length ? db.select().from(approvals).where(inArray(approvals.claimId, ids)) : [],
    ids.length ? db.select({ item: batchItems, batch: batches }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(inArray(batchItems.claimId, ids)) : [],
    ids.length ? db.select().from(claimEvidence).where(inArray(claimEvidence.claimId, ids)).orderBy(claimEvidence.createdAt) : [],
    ids.length ? db.select().from(investigations).where(inArray(investigations.claimId, ids)) : [],
  ]);
  const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? "" : "");
  const header = [
    "claim", "expense_date", "merchant", "category", "purpose", "status", "claimed", "currency", "receipt_amount", "receipt_currency", "fx_rate", "fx_source",
    "reimbursable", "excluded", "company_funded", "advance_funded", "adjustment", "adjustment_reason", "approved_by", "evidence", "missing_receipt_declared",
    "paypal_batches", "paypal_transactions", "open_exceptions", "client_to_bill", "recovery_status", "deposit_status", "closure_record",
  ];
  const lines = rows.map((c) => {
    const o = owed.get(c.id)!;
    const e = ev.filter((x) => x.claimId === c.id);
    const its = items.filter((i) => i.item.claimId === c.id);
    const exceptions = [
      ...findContradictions(e.map((x) => ({ id: x.id, kind: x.kind, extract: x.extractJson as EvidenceFacts["extract"] }))).filter((x) => !c.acknowledgedConflicts.some((a) => a.key === x.key)).map((x) => x.message),
      ...inv.filter((i) => i.claimId === c.id && i.status === "open").map(() => "payout reported missing"),
      ...(c.duplicateOfId && c.status === "pending_review" ? ["possible duplicate"] : []),
    ];
    return [
      `#${c.number}`, c.txnDate, c.vendor, c.category, c.purpose, facts.get(c.id)!.truth.label, centsToDecimal(c.amountCents), c.currency,
      c.receiptCents != null ? centsToDecimal(c.receiptCents) : "", c.receiptCurrency, c.fxRate ?? "", c.fxSource,
      centsToDecimal(o.reimbursableCents), centsToDecimal(o.excludedCents), centsToDecimal(o.companyFundedCents), centsToDecimal(o.advanceFundedCents),
      c.adjustmentCents ? centsToDecimal(c.adjustmentCents) : "", c.adjustmentReason,
      appr.filter((a) => a.claimId === c.id && !a.invalidatedAt).map((a) => `${name(a.approverId)} ${a.createdAt.toISOString().slice(0, 10)}`).join("; "),
      [...new Set(e.map((x) => x.kind))].join("; "), e.some((x) => x.kind === "declaration") ? "yes" : "no",
      [...new Set(its.map((i) => i.batch.paypalPayoutBatchId).filter(Boolean))].join("; "), its.map((i) => i.item.transactionId).filter(Boolean).join("; "),
      exceptions.join("; "), c.recoverableClient, c.recoveryStatus, c.kind === "deposit" ? c.depositStatus : "",
      `${appUrl}/app/claims/${c.id}/record`,
    ];
  });
  return [header, ...lines].map((l) => l.map(csv).join(",")).join("\n");
}
