"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls, Money } from "@/components/ui";
import { api } from "@/lib/client";
import type { Obligations } from "@/lib/settlement";

type Payment = { userId: string | null; source: "employee" | "company_card" | "advance"; amountCents: number };
type Entry = { id: string; kind: string; userId: string; amountCents: number; reference: string | null; createdAt: string };

const SOURCE: Record<string, string> = { employee: "Personal money", company_card: "Company card", advance: "Advance" };
const KIND: Record<string, string> = {
  payout: "PayPal payout",
  payout_reversal: "Payout bounced back",
  repayment: "Repaid outside PayPal",
  refund: "Merchant refund",
  clawback: "Returned to company",
};

type Props = {
  claimId: string;
  currency: string;
  totalCents: number;
  o: Obligations;
  payments: Payment[];
  entries: Entry[];
  members: { id: string; name: string }[];
  participants: string[];
  approvedBy: string | null;
  canEditFunding: boolean;
  canRecord: boolean;
};

/** The obligation breakdown: who paid, who benefits, who approved, who is owed what. */
export function SettlementCard({ claimId, currency, totalCents, o, payments, entries, members, participants, approvedBy, canEditFunding, canRecord }: Props) {
  const router = useRouter();
  const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? "Unknown" : "Company");
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(() => (payments.length ? payments : [{ userId: o.payees[0]?.userId ?? null, source: "employee" as const, amountCents: totalCents }]).map((p) => ({ ...p, amount: (p.amountCents / 100).toFixed(2) })));
  const [entry, setEntry] = useState({ kind: "repayment", userId: o.payees[0]?.userId ?? "", amount: "", reference: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const funded = payments.length ? payments : [{ userId: o.payees[0]?.userId ?? null, source: "employee" as const, amountCents: totalCents }];

  return (
    <div className="overflow-hidden rounded-[12px] border border-line bg-panel text-sm shadow-soft">
      <dl className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-muted">Paid by</dt>
          <dd className="mt-1 space-y-1">
            {funded.map((p, i) => (
              <p key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {p.source === "employee" ? name(p.userId) : SOURCE[p.source]}
                  {p.source === "employee" && <span className="text-xs text-muted"> · personal</span>}
                </span>
                <Money cents={p.amountCents} currency={currency} className="text-ink-2" />
              </p>
            ))}
          </dd>
        </div>
        <div className="bg-panel px-4 py-3">
          <dt className="text-xs text-muted">Benefits</dt>
          <dd className="mt-1">{participants.length ? participants.join(", ") : <span className="text-muted">Not recorded</span>}</dd>
          <dt className="mt-3 text-xs text-muted">Approved by</dt>
          <dd className="mt-1">{approvedBy ?? <span className="text-muted">Not approved yet</span>}</dd>
        </div>
      </dl>

      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 text-xs text-muted">
          Owed to employees <Money cents={o.reimbursableCents} currency={currency} className="text-ink" />
          {o.companyFundedCents + o.advanceFundedCents > 0 && <> · company-funded <Money cents={o.companyFundedCents + o.advanceFundedCents} currency={currency} /> not reimbursed</>}
          {o.excludedCents > 0 && <> · personal items <Money cents={o.excludedCents} currency={currency} /> excluded</>}
        </p>
        <ul className="space-y-1.5">
          {o.payees.map((p) => (
            <li key={p.userId} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{name(p.userId)}</span>
              <span className="text-right text-xs text-muted">
                owed <Money cents={p.owedCents} currency={currency} className="text-ink-2" /> · settled <Money cents={p.settledCents} currency={currency} className="text-ink-2" /> ·{" "}
                {p.outstandingCents >= 0 ? (
                  <>
                    remaining <Money cents={p.outstandingCents} currency={currency} className="font-semibold text-ink" />
                  </>
                ) : (
                  <span className="font-semibold text-warning">
                    owes back <Money cents={-p.outstandingCents} currency={currency} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {entries.length > 0 && (
        <ul className="divide-y divide-line border-t border-line bg-sunken/40 px-4 text-xs">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2">
              <span>
                {KIND[e.kind] ?? e.kind} · {name(e.userId)}
                {e.reference && <span className="ml-1 font-mono break-all text-muted">{e.reference}</span>}
              </span>
              <Money cents={e.amountCents} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      {canEditFunding && (
        <div className="border-t border-line px-4 py-3">
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-medium text-accent hover:underline">
              Split who paid (several people, company card, advance)
            </button>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select
                    aria-label="Funding source"
                    value={r.source}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, source: e.target.value as Payment["source"] } : x)))}
                    className={`${inputCls} w-auto`}
                  >
                    {Object.entries(SOURCE).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {r.source === "employee" && (
                    <select aria-label="Who paid" value={r.userId ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, userId: e.target.value } : x)))} className={`${inputCls} w-auto`}>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input aria-label="Amount" inputMode="decimal" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className={`${inputCls} money w-28`} />
                  <Button type="button" variant="ghost" size="sm" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <TrashIcon className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setRows([...rows, { userId: members[0]?.id ?? null, source: "employee", amountCents: 0, amount: "" }])}>
                  <PlusIcon className="size-4" aria-hidden /> Add payer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/claims/${claimId}/payments`, {
                          method: "PUT",
                          json: { payments: rows.map((r) => ({ userId: r.source === "employee" ? r.userId : null, source: r.source, amountCents: Math.round(Number(r.amount) * 100) })) },
                        }),
                      () => setEditing(false),
                    )
                  }
                >
                  Save who paid
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canRecord && o.payees.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => api(`/claims/${claimId}/ledger`, { json: { kind: entry.kind, userId: entry.userId, amountCents: Math.round(Number(entry.amount) * 100), reference: entry.reference || undefined } }),
              () => setEntry({ ...entry, amount: "", reference: "" }),
            );
          }}
        >
          <select aria-label="What happened" value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value })} className={`${inputCls} w-auto`}>
            <option value="repayment">Repaid outside PayPal</option>
            <option value="refund">Merchant refunded</option>
            <option value="clawback">Employee returned money</option>
          </select>
          <select aria-label="Person" value={entry.userId} onChange={(e) => setEntry({ ...entry, userId: e.target.value })} className={`${inputCls} w-auto`}>
            {o.payees.map((p) => (
              <option key={p.userId} value={p.userId}>
                {name(p.userId)}
              </option>
            ))}
          </select>
          <input aria-label="Amount" inputMode="decimal" placeholder="0.00" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} className={`${inputCls} money w-28`} required />
          <input aria-label="Reference" placeholder="Reference (optional)" value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} className={`${inputCls} w-44`} autoComplete="off" />
          <Button type="submit" variant="secondary" size="sm" disabled={busy}>
            Record
          </Button>
        </form>
      )}
      {err && (
        <div className="border-t border-line px-4 py-3">
          <Alert>{err}</Alert>
        </div>
      )}
    </div>
  );
}
