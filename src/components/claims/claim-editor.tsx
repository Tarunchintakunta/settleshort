"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, GitMergeIcon, XIcon } from "@phosphor-icons/react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Props = {
  claim: { id: string; vendor: string; amountCents: number; currency: string; txnDate: string | null; note: string; payerUserId: string; status: string; duplicateOfId: string | null };
  members: { id: string; name: string }[];
  isAdmin: boolean;
  canEdit: boolean;
  lowConfidence: boolean;
};

export function ClaimEditor({ claim, members, isAdmin, canEdit, lowConfidence }: Props) {
  const router = useRouter();
  const [f, setF] = useState({
    vendor: claim.vendor,
    amount: (claim.amountCents / 100).toFixed(2),
    currency: claim.currency,
    txnDate: claim.txnDate ?? "",
    note: claim.note,
    payerUserId: claim.payerUserId,
  });
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
          <Field label="Vendor">
            <input value={f.vendor} onChange={set("vendor")} className={inputCls} required />
          </Field>
        </div>
        <Field label="Amount">
          <input value={f.amount} onChange={set("amount")} inputMode="decimal" pattern="\d+(\.\d{1,2})?" className={`${inputCls} money`} required />
        </Field>
        <Field label="Currency">
          <select value={f.currency} onChange={set("currency")} className={inputCls}>
            {["USD", "INR", "EUR", "GBP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={f.txnDate} onChange={set("txnDate")} className={inputCls} />
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
          <Field label="Note">
            <input value={f.note} onChange={set("note")} className={inputCls} />
          </Field>
        </div>
      </fieldset>

      {lowConfidence && editable && <Alert tone="warning">Extraction confidence is low. Check each field against the receipt before marking it ready.</Alert>}
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}

      {editable && (
        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-start">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={busy}>
              Save changes
            </Button>
            {isAdmin && claim.status === "pending_review" && (
              <Button type="button" disabled={busy} onClick={() => run(() => patch({ markReady: true }), "Marked ready to settle")}>
                <CheckIcon className="size-4" weight="bold" aria-hidden /> Mark ready
              </Button>
            )}
            {isAdmin && claim.duplicateOfId && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => api("/claims/merge", { json: { ids: [claim.duplicateOfId, claim.id] } }), "Merged into the original claim")}
              >
                <GitMergeIcon className="size-4" aria-hidden /> Merge into original
              </Button>
            )}
          </div>
          {isAdmin && (
            <Button
              type="button"
              variant="danger"
              className="sm:ml-auto"
              disabled={busy}
              onClick={() => {
                const reason = prompt("Reason for rejecting (optional)") ?? undefined;
                run(() => api(`/claims/${claim.id}/reject`, { json: { reason } }), "Claim rejected");
              }}
            >
              <XIcon className="size-4" aria-hidden /> Reject
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
