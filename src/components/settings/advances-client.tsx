"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

export function AdvanceForm({ members }: { members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ userId: "", amount: "", currency: "USD", purpose: "", reference: "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mb-8 flex flex-wrap items-end gap-2 rounded-[12px] border border-line p-4 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await api("/advances", { json: { userId: f.userId, amountCents: Math.round(Number(f.amount) * 100), currency: f.currency, purpose: f.purpose, reference: f.reference || undefined } });
          setF({ ...f, amount: "", purpose: "", reference: "" });
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <select aria-label="To whom" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} className={`${inputCls} w-auto`} required>
        <option value="">Advance to…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input aria-label="Amount" inputMode="decimal" placeholder="500.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={`${inputCls} money w-28`} required />
      <select aria-label="Currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={`${inputCls} w-auto`}>
        {["USD", "INR", "EUR", "GBP"].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input aria-label="Purpose" placeholder="Bangalore customer trip" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} className={`${inputCls} min-w-[180px] flex-1`} required />
      <input aria-label="Reference" placeholder="Transfer reference" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={`${inputCls} w-40`} />
      <Button size="sm">Record advance</Button>
      {err && (
        <div className="w-full">
          <Alert>{err}</Alert>
        </div>
      )}
    </form>
  );
}

export function SettleAdvance({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await api(`/advances/${id}/settle`, { json: { note } });
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <input aria-label="Settlement note" placeholder="Leftover returned by bank transfer, ref…" value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} h-9 min-w-[220px] flex-1`} required />
      <Button size="sm" variant="secondary">
        Settle
      </Button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </form>
  );
}
