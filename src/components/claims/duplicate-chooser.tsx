"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Money } from "@/components/ui";
import { api } from "@/lib/client";

type Candidate = { id: string; number: number; vendor: string; amountCents: number; currency: string; txnDate: string | null; payer: string; score: number; reasons: string[] };

/** Explains each match with its signals; when two are close, a human picks. Nothing is merged automatically. */
export function DuplicateChooser({ claimId, candidates, ambiguous, canDecide }: { claimId: string; candidates: Candidate[]; ambiguous: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 space-y-2">
      {ambiguous && <p className="text-sm font-medium text-ink">Two claims match almost equally. Which one is this the same expense as?</p>}
      {candidates.map((c) => (
        <div key={c.id} className="rounded-[10px] border border-line bg-panel p-3 text-sm shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/app/claims/${c.id}`} className="font-medium hover:underline">
              #{c.number} {c.vendor || "Untitled"} · {c.payer}
              {c.txnDate && <span className="font-normal text-muted"> · {c.txnDate}</span>}
            </Link>
            <span className="flex items-baseline gap-3">
              <Money cents={c.amountCents} currency={c.currency} />
              <span className="tnum font-mono text-xs text-muted">{Math.round(c.score * 100)}% match</span>
            </span>
          </div>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {c.reasons.map((r) => (
              <span key={r} className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] text-ink-2">
                {r}
              </span>
            ))}
          </p>
          {canDecide && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api("/claims/merge", { json: { ids: [c.id, claimId] } }))}>
                Same expense: merge into #{c.number}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/claims/${claimId}/not-duplicate`, { json: { of: c.id } }))}>
                Different expense
              </Button>
            </div>
          )}
        </div>
      ))}
      {err && <Alert>{err}</Alert>}
    </div>
  );
}
