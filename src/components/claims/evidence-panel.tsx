"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChatTextIcon, FileIcon, PaperclipIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls, Money } from "@/components/ui";
import { api } from "@/lib/client";

export type EvidenceRow = {
  id: string;
  kind: string;
  source: string;
  fileName: string | null;
  fileMime: string | null;
  rawText: string | null;
  extract: {
    vendor?: string | null;
    amount_cents?: number;
    currency?: string;
    txn_date?: string | null;
    correction?: boolean;
    from?: Record<string, unknown>;
    to?: Record<string, unknown>;
  } | null;
  addedBy: string;
  addedById: string | null;
  privateFile: boolean;
  redactedCount: number;
  createdAt: string;
};

const KIND: Record<string, string> = { receipt: "Receipt", invoice: "Invoice", message: "Message", declaration: "Missing-receipt declaration", statement: "Statement" };

export function EvidencePanel({
  claimId,
  rows,
  canAdd,
  describeChange,
  viewerId,
  canShareStatement = false,
}: {
  claimId: string;
  rows: EvidenceRow[];
  canAdd: boolean;
  describeChange?: Record<string, string>;
  viewerId?: string;
  canShareStatement?: boolean;
}) {
  const [fix, setFix] = useState("");
  const [stmt, setStmt] = useState<{ text: string; keep: number[] } | null>(null);
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState("receipt");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setText("");
      router.refresh();
    } catch (e) {
      setErr(/s3 not configured/i.test((e as Error).message) ? "File storage isn't connected here. Paste the message text instead." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="evidence-h">
      <h2 id="evidence-h" className="mb-2 text-[15px] font-semibold tracking-[-0.015em]">
        Evidence <span className="font-normal text-muted">({rows.length})</span>
      </h2>
      <ul className="divide-y divide-line rounded-[12px] border border-line bg-panel text-sm shadow-soft">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 gap-2.5">
              {r.fileName ? <FileIcon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> : <ChatTextIcon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
              <div className="min-w-0">
                <p className="font-medium">
                  {r.extract?.correction ? "Correction" : (KIND[r.kind] ?? r.kind)} <span className="font-normal text-muted">· {r.addedBy}</span>
                </p>
                {r.extract?.correction && describeChange?.[r.id] && <p className="text-[12px] text-accent">{describeChange[r.id]}</p>}
                {r.redactedCount > 0 && <p className="text-[12px] text-muted">{r.redactedCount} unrelated statement line{r.redactedCount === 1 ? "" : "s"} hidden by the payer</p>}
                {r.fileName && r.privateFile && r.addedById !== viewerId ? (
                  <p className="text-[13px] text-muted">Statement file kept private by the uploader</p>
                ) : r.fileName ? (
                  <a href={`/api/v1/claims/${claimId}/evidence/${r.id}`} target="_blank" className="text-[13px] break-all text-accent hover:underline">
                    {r.fileName}
                  </a>
                ) : (
                  r.rawText && <p className="text-[13px] break-words text-ink-2">&ldquo;{r.rawText}&rdquo;</p>
                )}
              </div>
            </div>
            {r.extract?.amount_cents && !r.extract.correction ? <Money cents={r.extract.amount_cents} currency={r.extract.currency ?? "USD"} className="shrink-0 text-ink-2" /> : null}
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-3 text-muted">No evidence yet.</li>}
      </ul>

      {canAdd && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/claims/${claimId}/corrections`, { json: { text: fix.trim() } });
              setFix("");
            });
          }}
        >
          <input
            value={fix}
            onChange={(e) => setFix(e.target.value)}
            placeholder="Something wrong? Say it plainly: “Actually, Maya paid”"
            className={inputCls}
            aria-label="Correction"
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" disabled={busy || fix.trim().length < 3}>
            Correct
          </Button>
        </form>
      )}

      {canShareStatement && (
        <div className="mt-3">
          {!stmt ? (
            <button type="button" onClick={() => setStmt({ text: "", keep: [] })} className="text-[13px] font-medium text-accent hover:underline">
              Prove payment with your bank statement, privately
            </button>
          ) : (
            <div className="space-y-2 rounded-[10px] border border-line p-3">
              <p className="text-[13px] text-ink-2">Paste the statement lines, then tick only the payment. Everything else is dropped before it&apos;s saved.</p>
              <textarea
                aria-label="Statement lines"
                rows={4}
                value={stmt.text}
                onChange={(e) => setStmt({ text: e.target.value, keep: [] })}
                className="w-full rounded-[8px] border border-line bg-panel p-2 font-mono text-[12px]"
              />
              <ul className="space-y-1 font-mono text-[12px]">
                {stmt.text.split("\n").map((l, i) =>
                  l.trim() ? (
                    <li key={i}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--accent)]"
                          checked={stmt.keep.includes(i)}
                          onChange={(e) => setStmt({ ...stmt, keep: e.target.checked ? [...stmt.keep, i] : stmt.keep.filter((k) => k !== i) })}
                        />
                        <span className={stmt.keep.includes(i) ? "text-ink" : "text-muted line-through"}>{l}</span>
                      </label>
                    </li>
                  ) : null,
                )}
              </ul>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !stmt.keep.length}
                  onClick={() => run(async () => {
                    await api(`/claims/${claimId}/statement`, { json: { lines: stmt.text.split("\n"), keep: stmt.keep } });
                    setStmt(null);
                  })}
                >
                  Share {stmt.keep.length} line{stmt.keep.length === 1 ? "" : "s"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setStmt(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {canAdd && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a related Slack message or note"
              className={inputCls}
              aria-label="Related message"
              autoComplete="off"
            />
            <Button type="button" variant="secondary" disabled={busy || text.trim().length < 3} onClick={() => run(() => api(`/claims/${claimId}/evidence`, { json: { text: text.trim(), kind: "message" } }))}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} w-auto`} aria-label="File kind">
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
              <option value="statement">Statement</option>
            </select>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => file.current?.click()}>
              <PaperclipIcon className="size-4" aria-hidden /> Attach file
            </Button>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              aria-label="Evidence file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                fd.append("kind", kind);
                run(() => api(`/claims/${claimId}/evidence`, { method: "POST", body: fd }));
                e.target.value = "";
              }}
            />
          </div>
          {err && <Alert>{err}</Alert>}
        </div>
      )}
    </section>
  );
}
