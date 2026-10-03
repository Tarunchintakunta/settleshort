"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Inv = { id: string; reason: string; openedBy: string; notes: { by: string; text: string; at: string }[]; status: string; outcome: string | null };
const OUTCOME: Record<string, string> = { arrived: "Money arrived after all", returned_reissue: "PayPal returned it; repay in the next batch", other: "Closed for another reason" };

/** One tracked case for "PayPal says paid, the receiver says missing", from report to outcome. */
export function InvestigationPanel({ rows, canAct }: { rows: Inv[]; canAct: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const act = async (id: string, json: unknown) => {
    setErr(null);
    try {
      await api(`/investigations/${id}`, { json });
      setText("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  if (!rows.length) return null;
  return (
    <section className="mb-8 rounded-[12px] border border-danger/25 bg-danger-soft p-5 shadow-soft" aria-labelledby="inv-h">
      {rows.map((r) => (
        <div key={r.id}>
          <h2 id="inv-h" className="flex items-center gap-2 text-sm font-semibold text-danger">
            <MagnifyingGlassIcon className="size-4" aria-hidden /> {r.status === "open" ? "Investigation open" : `Investigation closed: ${OUTCOME[r.outcome ?? "other"]}`}
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">
            {r.openedBy}: &ldquo;{r.reason}&rdquo;
          </p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {r.notes.map((n, i) => (
              <li key={i}>
                <span className="text-muted">{n.by}:</span> {n.text}
              </li>
            ))}
          </ul>
          {canAct && r.status === "open" && (
            <div className="mt-3 space-y-2">
              <input aria-label="Note or reference" placeholder="What you checked, e.g. PayPal shows RETURNED, ref 7XG..." value={text} onChange={(e) => setText(e.target.value)} className={inputCls} autoComplete="off" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={text.trim().length < 2} onClick={() => act(r.id, { action: "note", text })}>
                  Add note
                </Button>
                {Object.entries(OUTCOME).map(([k, v]) => (
                  <Button key={k} size="sm" variant={k === "returned_reissue" ? "danger" : "ghost"} disabled={text.trim().length < 3} onClick={() => act(r.id, { action: "resolve", outcome: k, text })}>
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
