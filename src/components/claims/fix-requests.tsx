"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Req = { id: string; field: string; message: string; by: string; reply: string | null; resolved: boolean };
const FIELD: Record<string, string> = { attendees: "Attendees", receipt: "Receipt page", purpose: "Business purpose", amount: "Amount", date: "Date", merchant: "Merchant", other: "Other" };

/** Approvers ask for one specific fix; the claimant fixes it and replies. Nothing else restarts. */
export function FixRequests({ claimId, rows, canRequest, canReply }: { claimId: string; rows: Req[]; canRequest: boolean; canReply: boolean }) {
  const router = useRouter();
  const [ask, setAsk] = useState({ field: "attendees", message: "" });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const open = rows.filter((r) => !r.resolved);
  if (!open.length && !canRequest) return null;
  return (
    <section className="mb-8 rounded-[12px] border border-warning/30 bg-warning-soft/60 p-5 shadow-soft" aria-labelledby="fix-h">
      <h2 id="fix-h" className="text-sm font-semibold text-warning">
        {open.length ? `${open.length} fix${open.length === 1 ? "" : "es"} requested` : "Ask for a specific fix"}
      </h2>
      <ul className="mt-2 space-y-2">
        {open.map((r) => (
          <li key={r.id} className="rounded-[8px] border border-line bg-panel p-3 text-sm">
            <p>
              <b className="font-medium">{FIELD[r.field]}:</b> {r.message} <span className="text-xs text-muted">· {r.by}</span>
            </p>
            {canReply && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => api(`/claims/${claimId}/fix-requests/${r.id}`, { json: { reply: reply[r.id] ?? "" } }));
                }}
              >
                <input aria-label="Reply" placeholder="Fixed: added Sam and Rita as attendees" value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} className={inputCls} autoComplete="off" required />
                <Button size="sm" variant="secondary">
                  Mark fixed
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canRequest && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/claims/${claimId}/fix-requests`, { json: ask })).then(() => setAsk({ ...ask, message: "" }));
          }}
        >
          <select aria-label="What needs fixing" value={ask.field} onChange={(e) => setAsk({ ...ask, field: e.target.value })} className={`${inputCls} w-auto`}>
            {Object.entries(FIELD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input aria-label="What exactly" placeholder="Who else was at the dinner?" value={ask.message} onChange={(e) => setAsk({ ...ask, message: e.target.value })} className={`${inputCls} min-w-[220px] flex-1`} autoComplete="off" required />
          <Button size="sm" variant="secondary">
            Ask for this fix
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
