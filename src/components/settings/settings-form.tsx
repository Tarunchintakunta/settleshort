"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Ws = { name: string; maxSingleCents: number; maxBatchCents: number; alternateApproverId: string | null; receiptRequiredCents: number };

export function SettingsForm({ ws, isAdmin, members }: { ws: Ws; isAdmin: boolean; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ name: ws.name, single: String(ws.maxSingleCents / 100), batch: String(ws.maxBatchCents / 100), alt: ws.alternateApproverId ?? "", receipt: String(ws.receiptRequiredCents / 100) });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        try {
          await api("/workspaces/settings", {
            method: "PATCH",
            json: { name: f.name, maxSingleCents: Math.round(Number(f.single) * 100), maxBatchCents: Math.round(Number(f.batch) * 100), alternateApproverId: f.alt || null, receiptRequiredCents: Math.round(Number(f.receipt) * 100) },
          });
          setMsg({ ok: true, text: "Saved" });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        }
      }}
    >
      <fieldset disabled={!isAdmin} className="space-y-4">
        <Field label="Workspace name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Max single payout" hint="Approve is blocked above this">
            <input inputMode="decimal" value={f.single} onChange={(e) => setF({ ...f, single: e.target.value })} className={`${inputCls} money`} />
          </Field>
          <Field label="Max batch total">
            <input inputMode="decimal" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} className={`${inputCls} money`} />
          </Field>
        </div>
        <Field label="Receipt required from" hint="At or above this, a message alone isn't enough: attach a receipt or sign a missing-receipt declaration.">
          <input inputMode="decimal" value={f.receipt} onChange={(e) => setF({ ...f, receipt: e.target.value })} className={`${inputCls} money`} />
        </Field>
        <Field label="Alternate approver" hint="Approves claims that admins submit or are reimbursed for. Nobody can approve their own claim.">
          <select value={f.alt} onChange={(e) => setF({ ...f, alt: e.target.value })} className={inputCls}>
            <option value="">None: another admin approves</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
      <div className="flex items-center gap-3">
        {isAdmin && <Button>Save settings</Button>}
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
