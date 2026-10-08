"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { cx, inputCls, Pill } from "@/components/ui";
import type { RiskSignal } from "@/lib/risk";

// The risk card and the Approve buttons live in different parts of the page; this tiny store connects them.
type Ack = { acknowledged: boolean; note: string };
const acks = new Map<string, Ack>();
const listeners = new Set<() => void>();
const EMPTY: Ack = { acknowledged: false, note: "" };
export const getRiskAck = (claimId: string) => acks.get(claimId) ?? EMPTY;
function setRiskAck(claimId: string, a: Partial<Ack>) {
  acks.set(claimId, { ...getRiskAck(claimId), ...a });
  listeners.forEach((l) => l());
}
export function useRiskAck(claimId: string) {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => getRiskAck(claimId),
    () => EMPTY,
  );
}

const TONE = { high: "danger", medium: "warning", low: "neutral" } as const;

/** "Risk signals" on the claim page. A human still decides; High signals need an explicit tick before Approve. */
export function RiskSignals({ claimId, signals, canAcknowledge }: { claimId: string; signals: RiskSignal[]; canAcknowledge: boolean }) {
  const ack = useRiskAck(claimId);
  if (!signals.length) return null;
  const high = signals.some((s) => s.severity === "high");
  return (
    <section id="risk-signals" aria-labelledby="risk-h" className="rise mb-8 scroll-mt-40 rounded-[12px] border border-warning/30 bg-warning-soft p-5 shadow-soft">
      <p id="risk-h" className="flex items-center gap-2 text-sm font-medium text-warning">
        <WarningIcon className="size-4" weight="fill" aria-hidden /> Risk signals
      </p>
      <ul className="mt-3 space-y-2">
        {signals.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <Pill tone={TONE[s.severity]}>{s.severity[0].toUpperCase() + s.severity.slice(1)}</Pill>
            <span>{s.message.replace(/#\d+(, #\d+)*$/, "").trim()}</span>
            {s.related.map((r) => (
              <Link key={r.id} href={`/app/claims/${r.id}`} className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-2 md:min-h-0">
                #{r.number}
              </Link>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">These are hints, not a verdict. You decide.</p>
      {high && canAcknowledge && (
        <div className="mt-3 space-y-2 border-t border-warning/20 pt-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={ack.acknowledged} onChange={(e) => setRiskAck(claimId, { acknowledged: e.target.checked })} />
            I reviewed these signals
          </label>
          {ack.acknowledged && (
            <input
              aria-label="Override note (optional)"
              placeholder="Why it's fine to approve (optional)"
              maxLength={500}
              value={ack.note}
              onChange={(e) => setRiskAck(claimId, { note: e.target.value })}
              className={cx(inputCls, "h-10")}
            />
          )}
        </div>
      )}
    </section>
  );
}
