"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

/** Evidence that disagrees with itself. Approval stays blocked until someone accepts each one with a reason. */
export function ConflictsPanel({ claimId, conflicts, canResolve }: { claimId: string; conflicts: { key: string; message: string }[]; canResolve: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  if (!conflicts.length) return null;
  return (
    <section className="rise mb-8 rounded-[12px] border border-danger/25 bg-danger-soft p-5 shadow-soft" aria-labelledby="conflicts-h">
      <h2 id="conflicts-h" className="flex items-center gap-2 text-sm font-semibold text-danger">
        <WarningIcon className="size-4" weight="fill" aria-hidden /> The evidence disagrees
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">Fix the claim to match the right source, or accept the difference with a reason. Approval is blocked until then.</p>
      <ul className="mt-3 space-y-3">
        {conflicts.map((c) => (
          <li key={c.key} className="rounded-[8px] border border-line bg-panel p-3 text-sm">
            <p className="font-medium">{c.message}</p>
            {canResolve && (
              <form
                className="mt-2 flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErr(null);
                  try {
                    await api(`/claims/${claimId}/conflicts`, { json: { key: c.key, note: note[c.key] ?? "" } });
                    router.refresh();
                  } catch (x) {
                    setErr((x as Error).message);
                  }
                }}
              >
                <input
                  aria-label="Why the difference is fine"
                  placeholder="Why it's fine, e.g. tip added after the message"
                  value={note[c.key] ?? ""}
                  onChange={(e) => setNote({ ...note, [c.key]: e.target.value })}
                  className={`${inputCls} min-w-[240px] flex-1`}
                  autoComplete="off"
                  required
                  minLength={3}
                />
                <Button size="sm" variant="secondary">
                  Accept difference
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
