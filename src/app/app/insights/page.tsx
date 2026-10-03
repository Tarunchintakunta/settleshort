import { asc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { aiFeedback, approvals, batches, batchItems, claims, db, ledgerEntries } from "@/lib/db";
import { obligationsForMany } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { TERMINAL } from "@/lib/payout-status";

export const metadata = { title: "Insights" };

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const duration = (ms: number | null) => {
  if (ms == null) return "No data yet";
  const h = ms / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`;
};

/** Whether the product actually helps, measured from real rows only. No estimated savings. */
export default async function Insights() {
  const { workspace: ws } = await requirePageCtx();
  const all = await db.select().from(claims).where(eq(claims.workspaceId, ws.id));
  const ids = all.map((c) => c.id);
  const [appr, payouts, items, owed, feedback] = await Promise.all([
    ids.length ? db.select().from(approvals).where(inArray(approvals.claimId, ids)).orderBy(asc(approvals.createdAt)) : [],
    db.select().from(ledgerEntries).where(eq(ledgerEntries.workspaceId, ws.id)).orderBy(asc(ledgerEntries.createdAt)),
    db.select({ status: batchItems.status }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(eq(batches.workspaceId, ws.id)),
    obligationsForMany(all),
    db.select().from(aiFeedback).where(eq(aiFeedback.workspaceId, ws.id)),
  ]);
  const fb = (k: string) => feedback.filter((f) => f.kind === k).length;

  const firstApproval = new Map<string, Date>();
  for (const a of appr) if (!firstApproval.has(a.claimId)) firstApproval.set(a.claimId, a.createdAt);
  const approvalMs = all.flatMap((c) => (firstApproval.has(c.id) ? [firstApproval.get(c.id)!.getTime() - c.createdAt.getTime()] : []));
  const paidAt = new Map<string, Date>();
  for (const p of payouts) if (p.kind === "payout") paidAt.set(p.claimId, p.createdAt); // last payout = fully paid moment
  const paidMs = all.filter((c) => c.status === "paid" && paidAt.has(c.id)).map((c) => paidAt.get(c.id)!.getTime() - c.createdAt.getTime());

  const outstanding = new Map<string, number>();
  for (const c of all.filter((c) => ["matched", "in_batch", "partially_paid", "failed"].includes(c.status)))
    outstanding.set(c.currency, (outstanding.get(c.currency) ?? 0) + owed.get(c.id)!.outstandingCents);
  const unresolved = all.filter((c) => ["pending_review", "in_batch", "partially_paid", "failed"].includes(c.status)).length;
  const dupes = all.filter((c) => c.status === "rejected" && c.duplicateOfId);
  const dupeCents = new Map<string, number>();
  for (const d of dupes) dupeCents.set(d.currency, (dupeCents.get(d.currency) ?? 0) + d.amountCents);
  const terminal = items.filter((i) => TERMINAL.has(i.status));
  const success = terminal.filter((i) => i.status === "SUCCESS").length;
  // Company money sent beyond what was owed (refunds excluded): the double payment this product exists to prevent.
  const SENT: Record<string, number> = { payout: 1, repayment: 1, payout_reversal: -1, clawback: -1 };
  const overpaid = all.filter((c) =>
    owed.get(c.id)!.payees.some((p) => payouts.filter((x) => x.claimId === c.id && x.userId === p.userId).reduce((a, x) => a + (SENT[x.kind] ?? 0) * x.amountCents, 0) > p.owedCents),
  ).length;

  const sumBy = (rows: typeof all) => {
    const m = new Map<string, number>();
    for (const c of rows) m.set(c.currency, (m.get(c.currency) ?? 0) + c.amountCents);
    return m;
  };
  const money = (m: Map<string, number>) => ([...m].length ? [...m].map(([cur, v]) => formatMoney(v, cur)).join(" + ") : formatMoney(0, "USD"));
  const tiles = [
    { label: "Median submit to paid", value: duration(median(paidMs)), sub: `${paidMs.length} paid claims` },
    { label: "Median time to approval", value: duration(median(approvalMs)), sub: `${approvalMs.length} approved claims` },
    { label: "Employee money outstanding", value: money(outstanding), sub: "approved, not yet paid" },
    { label: "Unresolved claims", value: String(unresolved), sub: "in review, scheduled, partial or failed" },
    { label: "Duplicate claims stopped", value: String(dupes.length), sub: `${money(dupeCents)} not paid twice` },
    { label: "Payout success rate", value: terminal.length ? `${Math.round((success / terminal.length) * 100)}%` : "No data yet", sub: `${success} of ${terminal.length} PayPal items` },
    { label: "Deposits still held", value: money(sumBy(all.filter((c) => c.kind === "deposit" && c.depositStatus === "held"))), sub: "refundable deposits not yet back" },
    { label: "To bill to clients", value: money(sumBy(all.filter((c) => c.recoveryStatus === "to_invoice" || c.recoveryStatus === "invoiced"))), sub: "recoverable costs not yet recovered" },
    { label: "Over-payments", value: String(overpaid), sub: "claims where more was sent than owed. Must stay 0." },
  ];

  return (
    <>
      <PageHeader title="Insights" sub="Measured from this workspace's real activity. No estimated savings." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[12px] border border-line bg-panel p-5 shadow-soft">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="money mt-1 text-[26px] font-semibold tracking-[-0.02em]">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">People overruling the AI</h2>
            <p className="text-sm text-muted">Each correction is kept with its reason and feeds the evaluation set. It never changes company rules by itself.</p>
          </div>
          <a href="/api/v1/ai-feedback" className="text-[13px] font-medium text-accent hover:underline">
            Export as JSON Lines
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Extracted fields corrected", n: fb("extraction") },
            { label: "Duplicate flags overruled", n: fb("duplicate") },
            { label: "Merchant categories overridden", n: fb("category") },
          ].map((t) => (
            <div key={t.label} className="rounded-[12px] border border-line bg-panel p-4 shadow-soft">
              <p className="text-xs text-muted">{t.label}</p>
              <p className="tnum mt-1 text-[22px] font-semibold">{t.n}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-panel text-sm shadow-soft">
          {feedback.slice(-8).reverse().map((f) => (
            <li key={f.id} className="px-4 py-2.5">
              <span className="text-muted">{f.kind}</span> · {f.subject}: <span className="line-through decoration-muted">{f.suggested}</span> → <b className="font-medium">{f.corrected}</b>
              {f.reason && <span className="text-muted"> · &ldquo;{f.reason}&rdquo;</span>}
            </li>
          ))}
          {!feedback.length && <li className="px-4 py-2.5 text-muted">No corrections yet.</li>}
        </ul>
      </section>
    </>
  );
}
