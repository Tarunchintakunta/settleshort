"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client";
import { getRiskAck } from "@/components/claims/risk-signals";

type Props = {
  claim: { id: string; vendor: string; amountCents: number; currency: string; txnDate: string | null; note: string; purpose: string; category: string | null; categorySource: string | null; payerUserId: string; status: string; duplicateOfId: string | null };
  members: { id: string; name: string }[];
  isAdmin: boolean;
  canEdit: boolean;
  lowConfidence: boolean;
  /** null = this viewer may approve; otherwise why not (maker-checker). */
  approveBlocked: string | null;
  /** Waiting for a (re-)approval: in review, or batched with a voided approval. */
  approvable: boolean;
  /** Fields the extractor was unsure about (see lib/evidence.ts). */
  uncertain?: string[];
};

export function ClaimEditor({ claim, members, isAdmin, canEdit, lowConfidence, approveBlocked, approvable, uncertain = [] }: Props) {
  const unsure = (f: string) => (uncertain.includes(f) ? "border-warning ring-3 ring-warning/15" : "");
  const hint = (f: string) => (uncertain.includes(f) ? "AI unsure: check against the evidence" : undefined);
  const router = useRouter();
  const [f, setF] = useState({
    vendor: claim.vendor,
    amount: (claim.amountCents / 100).toFixed(2),
    currency: claim.currency,
    txnDate: claim.txnDate ?? "",
    note: claim.note,
    purpose: claim.purpose,
    category: claim.category ?? "",
    payerUserId: claim.payerUserId,
  });
  const [always, setAlways] = useState(false);
  const [adjust, setAdjust] = useState<{ amount: string; reason: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const editable = canEdit && ["draft", "pending_review", "matched"].includes(claim.status);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const patch = (extra: Record<string, unknown> = {}) =>
    api(`/claims/${claim.id}`, {
      method: "PATCH",
      json: {
        vendor: f.vendor,
        amountCents: Math.round(Number(f.amount) * 100),
        currency: f.currency,
        txnDate: f.txnDate || null,
        note: f.note,
        purpose: f.purpose,
        ...(f.category !== (claim.category ?? "") ? { category: f.category || null, categoryRule: always ? "always" : "once" } : {}),
        ...(isAdmin ? { payerUserId: f.payerUserId } : {}),
        ...extra,
      },
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => patch(), "Saved");
      }}
      className="space-y-4"
    >
      <fieldset disabled={!editable || busy} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Vendor" hint={hint("vendor")}>
            <input value={f.vendor} onChange={set("vendor")} className={`${inputCls} ${unsure("vendor")}`} required />
          </Field>
        </div>
        <Field label="Amount" hint={hint("amount")}>
          <input value={f.amount} onChange={set("amount")} inputMode="decimal" pattern="\d+(\.\d{1,2})?" className={`${inputCls} money ${unsure("amount")}`} required />
        </Field>
        <Field label="Currency" hint={hint("currency")}>
          <select value={f.currency} onChange={set("currency")} className={`${inputCls} ${unsure("currency")}`}>
            {["USD", "INR", "EUR", "GBP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Date" hint={hint("date")}>
          <input type="date" value={f.txnDate} onChange={set("txnDate")} className={`${inputCls} ${unsure("date")}`} />
        </Field>
        <Field label="Reimburse to">
          <select value={f.payerUserId} onChange={set("payerUserId")} className={inputCls} disabled={!isAdmin}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Category"
            hint={claim.categorySource === "mapping" && f.category === claim.category ? `From your merchant rule for ${claim.vendor}. Change it for this claim only, or update the rule.` : undefined}
          >
            <select value={f.category} onChange={set("category")} className={inputCls}>
              <option value="">Uncategorized</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {isAdmin && f.category && f.category !== (claim.category ?? "") && (
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Always use {f.category} for {claim.vendor || "this merchant"} (changes the merchant rule)
            </label>
          )}
        </div>
        <div className="sm:col-span-2">
          <Field label="Business purpose" hint="Why the company should pay. Required before approval.">
            <input value={f.purpose} onChange={set("purpose")} className={inputCls} placeholder="Client lunch with Acme" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Note">
            <input value={f.note} onChange={set("note")} className={inputCls} />
          </Field>
        </div>
      </fieldset>

      {adjust && (
        <div className="rounded-[10px] border border-line bg-sunken/60 p-3">
          <p className="text-[13px] font-medium">Approve a lower amount. The claimant sees the reason.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input aria-label="Approved amount" inputMode="decimal" placeholder="Approved amount" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} className={`${inputCls} money w-36`} />
            <select aria-label="Reason" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} className={`${inputCls} w-auto`}>
              <option value="over_policy">Over policy</option>
              <option value="personal">Personal item</option>
              <option value="missing_receipt">No receipt for part of it</option>
              <option value="duplicate_item">Already claimed</option>
              <option value="other">Other</option>
            </select>
            <input aria-label="Note for the claimant" placeholder="Note for the claimant" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} className={`${inputCls} min-w-[200px] flex-1`} />
            <Button
              type="button"
              size="sm"
              disabled={busy || !adjust.amount || adjust.note.trim().length < 3}
              onClick={() =>
                run(
                  () => api(`/claims/${claim.id}/adjust`, { json: { approvedCents: Math.round(Number(adjust.amount) * 100), reasonCode: adjust.reason, note: adjust.note.trim(), riskAcknowledged: getRiskAck(claim.id).acknowledged, riskNote: getRiskAck(claim.id).note.trim() || undefined } }),
                  "Approved the adjusted amount",
                ).then(() => setAdjust(null))
              }
            >
              Approve adjusted
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdjust(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {lowConfidence && editable && <Alert tone="warning">Extraction confidence is low. Check each field against the receipt before approving.</Alert>}
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}

      {/* Approve and Reject live in the claim header (see ClaimActions). */}
      {(editable || (!approveBlocked && approvable && claim.status === "pending_review")) && (
        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-start">
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button type="submit" variant="secondary" disabled={busy}>
                Save changes
              </Button>
            )}
            {approvable && !approveBlocked && claim.status === "pending_review" && !adjust && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setAdjust({ amount: "", reason: "over_policy", note: "" })}>
                Approve less…
              </Button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
