"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

/** Submitter takes back a claim that isn't in a batch yet. Reason required; it stays in the audit log. */
export function WithdrawButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center text-[13px] text-muted transition-colors hover:text-danger md:min-h-0">
        Withdraw claim
      </button>
    );
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api(`/claims/${claimId}/withdraw`, { json: { reason } });
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
          setBusy(false);
        }
      }}
    >
      <input autoFocus aria-label="Why you are withdrawing" placeholder="Why? e.g. submitted twice" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} h-9 min-w-[220px] flex-1 text-sm`} required minLength={3} />
      <Button size="sm" variant="danger" disabled={busy}>
        {busy ? "Withdrawing…" : "Withdraw"}
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
        Keep it
      </Button>
      {err && (
        <div className="w-full">
          <Alert>{err}</Alert>
        </div>
      )}
    </form>
  );
}
