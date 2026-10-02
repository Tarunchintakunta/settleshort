"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

export function SettingsForm({ ws, isAdmin }: { ws: { name: string; maxSingleCents: number; maxBatchCents: number }; isAdmin: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ name: ws.name, single: String(ws.maxSingleCents / 100), batch: String(ws.maxBatchCents / 100) });
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
            json: { name: f.name, maxSingleCents: Math.round(Number(f.single) * 100), maxBatchCents: Math.round(Number(f.batch) * 100) },
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
            <input inputMode="decimal" value={f.single} onChange={(e) => setF({ ...f, single: e.target.value })} className={`${inputCls} tnum font-mono`} />
          </Field>
          <Field label="Max batch total">
            <input inputMode="decimal" value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} className={`${inputCls} tnum font-mono`} />
          </Field>
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        {isAdmin && <Button>Save settings</Button>}
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
