"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { Button, cx, inputCls } from "@/components/ui";
import { api } from "@/lib/client";
import { getRiskAck } from "@/components/claims/risk-signals";

const UNDO_SECONDS = 5;

type Props = {
  claimId: string;
  /** Show Approve at all (waiting for approval and the viewer is an approver). */
  canApprove: boolean;
  /** Why this viewer can't approve right now (maker-checker), or null. */
  approveBlocked: string | null;
  canReject: boolean;
  /** High soft-fraud signal present: Approve needs "I reviewed these signals" ticked first. */
  needsRiskAck?: boolean;
  /** Open questions the claim still needs answered; Approve points at them instead of waiting five seconds to fail. */
  missing?: string[];
  /** "bar": fixed bottom bar for phones. "inline": the sticky header on larger screens. */
  variant: "bar" | "inline";
};

/**
 * Approve / Reject for the claim header. Approve waits five seconds with an Undo before anything is sent,
 * so a mis-tap never approves; the server-side approval rules are unchanged.
 */
export function ClaimActions({ claimId, canApprove, approveBlocked, canReject, needsRiskAck, missing = [], variant }: Props) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  useEffect(() => {
    if (rejecting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [rejecting]);

  async function reject() {
    setBusy(true);
    try {
      await api(`/claims/${claimId}/reject`, { json: { reason } });
      setRejecting(false);
      setMsg({ ok: true, text: "Claim rejected. The submitter sees your reason." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setRejecting(false);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const r = await api<{ approvalNeeded: string | null }>(`/claims/${claimId}`, {
        method: "PATCH",
        json: { markReady: true, ...(needsRiskAck && { riskAcknowledged: getRiskAck(claimId).acknowledged, riskNote: getRiskAck(claimId).note.trim() || undefined }) },
      });
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
    if (missing.length) {
      setMsg({ ok: false, text: `Answer first: ${missing.join(" ")}` });
      const card = document.getElementById("missing-h")?.closest("section");
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
      return;
    }
    if (needsRiskAck && !getRiskAck(claimId).acknowledged) {
      setMsg({ ok: false, text: "Review the risk signals and tick \"I reviewed these signals\" before approving." });
      document.getElementById("risk-signals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
            onClick={() => {
              setMsg(null);
              setReason("");
              setRejecting(true);
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

      {canReject && (
        <dialog
          ref={dialog}
          onClose={() => setRejecting(false)}
          aria-labelledby={`reject-title-${variant}`}
          className="m-auto w-[min(92vw,440px)] max-w-full rounded-[16px] border border-line bg-panel p-0 text-ink shadow-pop backdrop:bg-[rgb(12_12_14/0.55)] backdrop:backdrop-blur-[6px] open:animate-[rise_280ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          <form
            method="dialog"
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length >= 3) void reject();
            }}
          >
            <h2 id={`reject-title-${variant}`} className="text-[20px] font-semibold tracking-[-0.03em]">
              Reject this claim?
            </h2>
            <p className="mt-1 text-sm text-ink-2">The submitter gets your reason. Nothing is paid.</p>
            <label className="mt-4 block text-sm font-medium" htmlFor={`reject-reason-${variant}`}>
              Reason
            </label>
            <textarea
              id={`reject-reason-${variant}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder="e.g. Personal expense, not a team one"
              className={cx(inputCls, "mt-1.5 h-auto py-2")}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Keep it
              </Button>
              <Button type="submit" variant="danger" disabled={busy || reason.trim().length < 3}>
                {busy ? "Rejecting…" : "Reject claim"}
              </Button>
            </div>
          </form>
        </dialog>
      )}

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
