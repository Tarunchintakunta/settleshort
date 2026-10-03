"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Alert, Button, cx, inputCls, Money, Pill } from "@/components/ui";
import { api } from "@/lib/client";

type Row = {
  id: string;
  name: string;
  amountCents: number;
  extraCents: number;
  totalCents: number;
  excluded: boolean;
  excludeReason?: string | null;
  state: string;
  decisionNote?: string | null;
};

const REASON: Record<string, string> = { personal: "Personal", over_policy: "Over policy", missing_receipt: "No receipt", duplicate_item: "Already claimed", other: "Other" };
const STATE: Record<string, ["neutral" | "success" | "warning" | "danger", string]> = {
  pending: ["neutral", "Pending"],
  approved: ["success", "Approved"],
  held: ["warning", "Held"],
  disputed: ["danger", "Disputed"],
};

/**
 * Line items with their share of tax and tip. The claimant can exclude personal items; an approver can
 * approve, hold or dispute each line, so the agreed part gets paid while the disagreement stays visible.
 */
export function LinesCard({
  claimId,
  currency,
  rows,
  extrasCents,
  canEdit,
  canDecide,
}: {
  claimId: string;
  currency: string;
  rows: Row[];
  extrasCents: number;
  canEdit: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ name: string; amount: string; excluded: boolean; excludeReason: string | null }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const real = rows.filter((r) => r.id !== "unitemized");
  const startEdit = () =>
    setDraft(real.length ? real.map((r) => ({ name: r.name, amount: (r.amountCents / 100).toFixed(2), excluded: r.excluded, excludeReason: r.excludeReason ?? null })) : [{ name: "", amount: "", excluded: false, excludeReason: null }]);

  return (
    <section aria-labelledby="lines-h">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="lines-h" className="text-[15px] font-semibold tracking-[-0.015em]">
          Line items
        </h2>
        {canEdit && !draft && (
          <button type="button" onClick={startEdit} className="text-[13px] font-medium text-accent hover:underline">
            {real.length ? "Edit or exclude items" : "Itemize"}
          </button>
        )}
      </div>

      {!draft ? (
        rows.length ? (
          <ul className="divide-y divide-line rounded-[12px] border border-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className={cx("px-4 py-2.5", r.excluded && "bg-sunken/60")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className={cx("min-w-0", r.excluded ? "text-muted line-through" : "text-ink-2")}>{r.name}</span>
                  <span className="flex items-baseline gap-2">
                    {r.id !== "unitemized" && !r.excluded && (
                      <Pill tone={STATE[r.state]?.[0] ?? "neutral"} className="h-5 px-2 text-[11px]">
                        {STATE[r.state]?.[1] ?? r.state}
                      </Pill>
                    )}
                    <Money cents={r.totalCents} currency={currency} className={r.excluded ? "text-muted line-through" : ""} />
                  </span>
                </div>
                <p className="text-[11.5px] text-muted">
                  <Money cents={r.amountCents} currency={currency} />
                  {r.extraCents > 0 && (
                    <>
                      {" "}
                      + <Money cents={r.extraCents} currency={currency} /> tax and tip share
                    </>
                  )}
                  {r.excluded && <span className="ml-1 text-warning">· not reimbursed ({REASON[r.excludeReason ?? ""] ?? "excluded"})</span>}
                  {r.decisionNote && <span className="ml-1">· {r.decisionNote}</span>}
                </p>
                {canDecide && r.id !== "unitemized" && !r.excluded && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(["approved", "held", "disputed"] as const)
                      .filter((s) => s !== r.state)
                      .map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={s === "approved" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-[12px]"
                          disabled={busy}
                          onClick={() => {
                            const note = s === "approved" ? undefined : (prompt(`What's wrong with "${r.name}"? The claimant sees this.`) ?? "");
                            if (s !== "approved" && !note) return;
                            run(() => api(`/claims/${claimId}/lines/${r.id}`, { json: { state: s, note } }));
                          }}
                        >
                          {s === "approved" ? "Approve line" : s === "held" ? "Hold" : "Dispute"}
                        </Button>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-sm text-muted">Not itemized. Itemize to exclude a personal item without rejecting the whole receipt.</p>
        )
      ) : (
        <div className="space-y-2 rounded-[12px] border border-line p-3">
          {draft.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input aria-label="Item" value={d.name} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Item" className={`${inputCls} min-w-[140px] flex-1`} />
              <input aria-label="Price" inputMode="decimal" value={d.amount} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder="0.00" className={`${inputCls} money w-24`} />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={d.excluded} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, excluded: e.target.checked, excludeReason: e.target.checked ? (x.excludeReason ?? "personal") : null } : x)))} className="size-4 accent-[var(--accent)]" />
                Exclude
              </label>
              {d.excluded && (
                <select aria-label="Why excluded" value={d.excludeReason ?? "personal"} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, excludeReason: e.target.value } : x)))} className={`${inputCls} w-auto`}>
                  {Object.entries(REASON).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
          <p className="text-xs text-muted">
            Tax and tip (<Money cents={extrasCents} currency={currency} />) are spread over the items by price, so an excluded item takes its share with it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft([...draft, { name: "", amount: "", excluded: false, excludeReason: null }])}>
              <PlusIcon className="size-4" aria-hidden /> Add item
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api(`/claims/${claimId}/lines`, {
                      method: "PUT",
                      json: { lines: draft.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), amountCents: Math.round(Number(d.amount) * 100), excluded: d.excluded, excludeReason: d.excludeReason })) },
                    }),
                  () => setDraft(null),
                )
              }
            >
              Save items
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
