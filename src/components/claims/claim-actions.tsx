"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { Button, cx } from "@/components/ui";
import { api } from "@/lib/client";

const UNDO_SECONDS = 5;

type Props = {
  claimId: string;
  /** Show Approve at all (waiting for approval and the viewer is an approver). */
  canApprove: boolean;
  /** Why this viewer can't approve right now (maker-checker), or null. */
  approveBlocked: string | null;
  canReject: boolean;
  /** "bar": fixed bottom bar for phones. "inline": the sticky header on larger screens. */
  variant: "bar" | "inline";
};

/**
 * Approve / Reject for the claim header. Approve waits five seconds with an Undo before anything is sent,
 * so a mis-tap never approves; the server-side approval rules are unchanged.
 */
export function ClaimActions({ claimId, canApprove, approveBlocked, canReject, variant }: Props) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function send() {
    setBusy(true);
    try {
      const r = await api<{ approvalNeeded: string | null }>(`/claims/${claimId}`, { method: "PATCH", json: { markReady: true } });
      setMsg({ ok: true, text: r.approvalNeeded ? `Signed off. Still needs ${r.approvalNeeded}.` : "Approved" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startApprove() {
    setMsg(null);
    const until = Date.now() + UNDO_SECONDS * 1000;
    setLeft(UNDO_SECONDS);
    timer.current = setInterval(() => {
      const s = Math.ceil((until - Date.now()) / 1000);
      if (s > 0) return setLeft(s);
      clearInterval(timer.current!);
      setLeft(null);
      void send();
    }, 250);
  }

  function undo() {
    if (timer.current) clearInterval(timer.current);
    setLeft(null);
    setMsg({ ok: true, text: "Approval cancelled" });
  }

  if (!canApprove && !canReject) return null;
  const pending = left !== null;

  return (
    <>
      <div className={cx("flex items-center gap-2", variant === "bar" && "w-full")}>
        {canReject && (
          <Button
            type="button"
            variant="danger"
            className={cx(variant === "bar" && "h-11 flex-1")}
            disabled={busy || pending}
            onClick={async () => {
              const reason = prompt("Reason for rejecting (optional)");
              if (reason === null) return;
              setBusy(true);
              setMsg(null);
              try {
                await api(`/claims/${claimId}/reject`, { json: { reason: reason || undefined } });
                setMsg({ ok: true, text: "Claim rejected" });
                router.refresh();
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            <XIcon className="size-4" aria-hidden /> Reject
          </Button>
        )}
        {canApprove && (
          <Button
            type="button"
            variant="approve"
            className={cx(variant === "bar" && "h-11 flex-[2]")}
            disabled={busy || pending || !!approveBlocked}
            title={approveBlocked ?? undefined}
            onClick={startApprove}
          >
            <CheckIcon className="size-4" weight="bold" aria-hidden /> {busy ? "Approving…" : "Approve"}
          </Button>
        )}
      </div>
      {variant === "inline" && approveBlocked && canApprove && <p className="mt-1 max-w-[32ch] text-right text-xs text-muted">{approveBlocked}</p>}

      {/* Portal: the sticky header's backdrop blur would otherwise trap this fixed toast inside it. */}
      {(pending || msg) &&
        createPortal(
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-[12px] bg-ink px-4 py-3 text-sm text-panel shadow-pop md:bottom-6"
        >
          <span className="min-w-0 flex-1">{pending ? `Approving in ${left}s…` : msg!.text}</span>
          {pending ? (
            <button type="button" onClick={undo} className="min-h-11 rounded-[8px] px-3 font-semibold text-accent-soft underline underline-offset-4">
              Undo
            </button>
          ) : (
            <button type="button" onClick={() => setMsg(null)} aria-label="Dismiss" className="flex size-11 items-center justify-center rounded-[8px] opacity-70 hover:opacity-100">
              <XIcon className="size-4" aria-hidden />
            </button>
          )}
        </div>,
          document.body,
        )}
    </>
  );
}
