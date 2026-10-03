"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputCls, Money } from "@/components/ui";
import { api } from "@/lib/client";

type Props = {
  claimId: string;
  receipt: { cents: number; currency: string };
  charged: { cents: number; currency: string } | null;
  reimbursed: { cents: number; currency: string };
  fx: { rate: number | null; source: string | null; at: string | null };
  canEdit: boolean;
};

/** Receipt currency, card-charged amount and reimbursement amount side by side, with the conversion basis. */
export function CurrencyCard({ claimId, receipt, charged, reimbursed, fx, canEdit }: Props) {
  const router = useRouter();
  const [f, setF] = useState<{ amount: string; currency: string; reimburse: "charged" | "receipt"; source: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const differs = charged && (charged.currency !== receipt.currency || charged.cents !== receipt.cents);
  return (
    <section aria-labelledby="fx-h" className="rounded-[12px] border border-line bg-panel p-4 text-sm shadow-soft">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="fx-h" className="text-[15px] font-semibold tracking-[-0.015em]">
          Currency
        </h2>
        {canEdit && !f && (
          <button type="button" onClick={() => setF({ amount: "", currency: reimbursed.currency, reimburse: "charged", source: "Card statement" })} className="text-[13px] font-medium text-accent hover:underline">
            {charged ? "Update card charge" : "Card charged a different amount?"}
          </button>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-xs text-muted">On the receipt</dt>
          <dd>
            <Money cents={receipt.cents} currency={receipt.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Card charged</dt>
          <dd>{charged ? <Money cents={charged.cents} currency={charged.currency} /> : <span className="text-muted">Same</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Reimbursed</dt>
          <dd className="font-semibold">
            <Money cents={reimbursed.cents} currency={reimbursed.currency} />
          </dd>
        </div>
      </dl>
      {differs && fx.rate != null && (
        <p className="mt-2 text-xs text-muted">
          Basis: 1 {receipt.currency} = {fx.rate} {charged!.currency}, from {fx.source}
          {fx.at && ` on ${new Date(fx.at).toLocaleDateString("en-US", { dateStyle: "medium" })}`}.
        </p>
      )}
      {f && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await api(`/claims/${claimId}/currency`, { method: "PUT", json: { chargedCents: Math.round(Number(f.amount) * 100), chargedCurrency: f.currency, reimburse: f.reimburse, fxSource: f.source } });
              setF(null);
              router.refresh();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          <input aria-label="Charged amount" inputMode="decimal" placeholder="Charged" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={`${inputCls} money w-28`} required />
          <select aria-label="Charged currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={`${inputCls} w-auto`}>
            {["USD", "INR", "EUR", "GBP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Reimburse" value={f.reimburse} onChange={(e) => setF({ ...f, reimburse: e.target.value as "charged" | "receipt" })} className={`${inputCls} w-auto`}>
            <option value="charged">Reimburse the charged amount</option>
            <option value="receipt">Reimburse the receipt amount</option>
          </select>
          <input aria-label="Rate source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={`${inputCls} w-40`} />
          <Button size="sm" variant="secondary">
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setF(null)}>
            Cancel
          </Button>
        </form>
      )}
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
