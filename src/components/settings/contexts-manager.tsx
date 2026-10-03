"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Ctx = { id: string; kind: string; name: string; startsOn: string | null; endsOn: string | null };
const KIND: Record<string, string> = { customer_meeting: "Customer meeting", project: "Project", event: "Event" };

/** The approved business context purposes are suggested from. Nothing outside this list is ever suggested. */
export function ContextsManager({ rows, isAdmin }: { rows: Ctx[]; isAdmin: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ kind: "customer_meeting", name: "", startsOn: "", endsOn: "" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="text-muted">{KIND[r.kind]}</span> · <b className="font-medium">{r.name}</b>
              <span className="ml-2 text-xs text-muted">
                {r.startsOn}
                {r.endsOn ? ` to ${r.endsOn}` : r.kind === "project" ? " onward" : ""}
              </span>
            </span>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${r.name}`}
                onClick={async () => {
                  await api(`/contexts/${r.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                <TrashIcon className="size-4" aria-hidden />
              </Button>
            )}
          </li>
        ))}
        {!rows.length && <li className="py-2 text-muted">No meetings or projects yet.</li>}
      </ul>
      {isAdmin && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await api("/contexts", { json: { kind: f.kind, name: f.name, startsOn: f.startsOn, endsOn: f.endsOn || null } });
              setF({ ...f, name: "", startsOn: "", endsOn: "" });
              router.refresh();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          <select aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={`${inputCls} w-auto`}>
            {Object.entries(KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input aria-label="Name" placeholder="Acme renewal" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} min-w-[160px] flex-1`} required />
          <input aria-label="Date" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} className={`${inputCls} w-auto`} required />
          {f.kind === "project" && <input aria-label="Ends" type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} className={`${inputCls} w-auto`} />}
          <Button size="sm" variant="secondary">
            Add
          </Button>
        </form>
      )}
      {err && <Alert>{err}</Alert>}
    </div>
  );
}
