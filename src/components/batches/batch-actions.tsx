"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowsClockwiseIcon, DownloadSimpleIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Alert, Button, cx, inputCls } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Props = {
  batch: { id: string; status: string; totalCents: number; currency: string; name: string };
  recipients: number;
  isAdmin: boolean;
  blocked: string | null;
  mode: string;
};

export function BatchActions({ batch, recipients, isAdmin, blocked, mode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const total = formatMoney(batch.totalCents, batch.currency);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  // While PayPal processes, poll status (webhooks also update it server-side).
  useEffect(() => {
    if (!["submitted", "submitting"].includes(batch.status)) return;
    let n = 0;
    const t = setInterval(async () => {
      if (++n > 15) return clearInterval(t);
      await api(`/batches/${batch.id}/refresh-status`, { method: "POST" }).catch(() => null);
      router.refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [batch.id, batch.status, router]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api(`/batches/${batch.id}/approve`, { json: { confirm: typed } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/v1/batches/${batch.id}/export`} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-line bg-panel px-4 text-sm font-medium hover:bg-sunken">
        <DownloadSimpleIcon className="size-4" aria-hidden /> Export CSV
      </a>
      {["submitted", "partial"].includes(batch.status) && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await api(`/batches/${batch.id}/refresh-status`, { method: "POST" }).catch((e) => setError(e.message));
            setBusy(false);
            router.refresh();
          }}
        >
          <ArrowsClockwiseIcon className={cx("size-4", busy && "animate-spin")} aria-hidden /> Refresh status
        </Button>
      )}
      {batch.status === "awaiting_approval" && (
        <Button
          variant="approve"
          size="lg"
          disabled={!isAdmin || !!blocked}
          title={!isAdmin ? "Only admins can approve payouts" : blocked ?? undefined}
          onClick={() => {
            setTyped("");
            setError(null);
            setOpen(true);
          }}
        >
          <ShieldCheckIcon className="size-5" weight="fill" aria-hidden /> Approve &amp; Pay
        </Button>
      )}
      {error && !open && (
        <div className="w-full">
          <Alert>{error}</Alert>
        </div>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="approve-title"
        className="m-auto w-[min(92vw,440px)] rounded-[16px] border border-line bg-panel p-0 text-ink shadow-pop backdrop:bg-black/45 backdrop:backdrop-blur-[3px] open:animate-[rise_220ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <form
          method="dialog"
          className="p-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed === "APPROVE") approve();
          }}
        >
          <div className="mb-5 inline-flex rounded-full bg-success-soft p-2.5 text-success">
            <ShieldCheckIcon className="size-6" weight="fill" aria-hidden />
          </div>
          <h2 id="approve-title" className="text-xl font-semibold tracking-tight">
            Pay {recipients} {recipients === 1 ? "person" : "people"} {total}?
          </h2>
          <p className="mt-2 text-sm text-muted">
            This sends <b className="text-ink">{batch.name}</b> to PayPal Payouts{mode === "sandbox" ? " in sandbox" : " (simulator)"}. Once PayPal accepts it, it can&apos;t be undone.
          </p>
          <label className="mt-5 block text-sm font-medium" htmlFor="confirm">
            Type <span className="font-mono">APPROVE</span> to confirm
          </label>
          <input id="confirm" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className={cx(inputCls, "mt-1.5 h-11 font-mono tracking-[0.2em]")} />
          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="approve" disabled={typed !== "APPROVE" || busy}>
              {busy ? "Sending to PayPal…" : `Approve & Pay ${total}`}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
