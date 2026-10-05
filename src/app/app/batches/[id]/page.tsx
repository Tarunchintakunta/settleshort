import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, MinusIcon, WarningIcon, XIcon } from "@phosphor-icons/react/ssr";
import { BatchActions } from "@/components/batches/batch-actions";
import { Confidence, cx, Money, Pill, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { LOW_CONFIDENCE } from "@/lib/claims";
import { auditEvents, batches, batchItems, claims, db, memberships } from "@/lib/db";
import { releaseProblems } from "@/lib/approvals";
import { unverifiedReceivers } from "@/lib/batches";
import { formatMoney } from "@/lib/money";
import { paypalMode } from "@/lib/paypal";
import { claimTitle } from "@/lib/title";

export const metadata = { title: "Batch" };

export default async function BatchPage({ params }: PageProps<"/app/batches/[id]">) {
  const { id } = await params;
  const ctx = await requirePageCtx();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, id), eq(batches.workspaceId, ctx.workspace.id)));
  if (!batch) notFound();
  const [items, events] = await Promise.all([
    db.select({ item: batchItems, claim: claims }).from(batchItems).innerJoin(claims, eq(claims.id, batchItems.claimId)).where(eq(batchItems.batchId, id)),
    db.select().from(auditEvents).where(and(eq(auditEvents.entityId, id), eq(auditEvents.workspaceId, ctx.workspace.id))).orderBy(asc(auditEvents.createdAt)),
  ]);

  const ws = ctx.workspace;
  const pending = batch.status === "awaiting_approval";
  const [changes, [me], unverified] = await Promise.all([
    pending ? releaseProblems(ws.id, items.map((i) => i.claim.id)) : Promise.resolve([]),
    db.select().from(memberships).where(and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, ctx.user.id))),
    pending ? unverifiedReceivers(ws.id, items.map((i) => i.item)) : Promise.resolve([] as string[]),
  ]);
  const warnings: string[] = [];
  const low = items.filter((i) => i.claim.aiConfidence != null && i.claim.aiConfidence < LOW_CONFIDENCE);
  if (low.length) warnings.push(`${low.length} claim(s) have low AI confidence: ${low.map((l) => "#" + l.claim.number).join(", ")}`);
  const overSingle = items.filter((i) => i.item.amountCents > ws.maxSingleCents);
  if (overSingle.length) warnings.push(`${overSingle.length} payout(s) exceed the single-payout cap of ${formatMoney(ws.maxSingleCents, batch.currency)}`);
  if (batch.totalCents > ws.maxBatchCents) warnings.push(`Batch total exceeds the cap of ${formatMoney(ws.maxBatchCents, batch.currency)}`);
  const blocked = changes.length
    ? "Some claims changed since they were approved. Re-approve them first."
    : unverified.length
      ? `Verify the PayPal address of ${unverified.join(", ")} on the Members page first.`
    : !me?.canRelease
      ? "You can approve claims but not release money. Someone with release authority must."
      : overSingle.length || batch.totalCents > ws.maxBatchCents
        ? "Over the safety caps. Adjust them in Settings."
        : null;
  const recipients = new Set(items.map((i) => i.item.receiverEmail)).size;

  const at = (action: string) => events.find((e) => e.action === action)?.createdAt;
  type StepState = "done" | "failed" | "skipped" | "todo";
  const failed = batch.status === "failed";
  const sent = !!batch.paypalPayoutBatchId;
  const timeline: { label: string; at: Date | null | undefined; state: StepState }[] = [
    { label: "Batch created", at: batch.createdAt, state: "done" },
    { label: "Approved by a human", at: batch.approvedAt, state: batch.approvedAt ? "done" : "todo" },
    ...(at("payout.uncertain") ? [{ label: "PayPal outcome unknown, held", at: at("payout.uncertain"), state: "done" as const }] : []),
    sent
      ? { label: at("payout.verified") ? "Verified with PayPal, not resent" : "Sent to PayPal Payouts", at: at("payout.verified") ?? at("payout.created"), state: "done" }
      : failed
        ? { label: "Rejected by PayPal", at: at("payout.failed"), state: "failed" }
        : { label: "Sent to PayPal Payouts", at: null, state: "todo" },
    failed
      ? { label: "Failed, nothing paid", at: at("batch.failed") ?? at("payout.failed"), state: "failed" }
      : batch.status === "partial"
        ? { label: "Partially paid", at: at("batch.partial"), state: "failed" }
        : { label: "Paid", at: at("batch.completed"), state: batch.status === "completed" ? "done" : "todo" },
  ];
  // A failed step makes every later unreached step "skipped" (grey), not pending.
  const firstFail = timeline.findIndex((t) => t.state === "failed");
  if (firstFail >= 0) timeline.forEach((t, i) => i > firstFail && t.state === "todo" && (t.state = "skipped"));
  const DOT: Record<StepState, string> = {
    done: "border-success bg-success text-on-success",
    failed: "border-danger bg-danger text-on-accent",
    skipped: "border-line-strong bg-sunken text-muted",
    todo: "border-line-strong bg-panel text-transparent",
  };

  return (
    <>
      <Link href="/app/batches" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink">
        <ArrowLeftIcon className="size-3.5" aria-hidden /> Batches
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={batch.status} />
            {batch.paypalMode && <Pill dot>PayPal {batch.paypalMode}</Pill>}
          </div>
          <h1 className="mt-3 break-words text-[26px] font-semibold tracking-[-0.03em] sm:text-[28px]">{batch.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {items.length} claims to {recipients} {recipients === 1 ? "person" : "people"}
          </p>
        </div>
        <Money cents={batch.totalCents} currency={batch.currency} className="text-[44px] leading-none font-semibold sm:text-[56px]" />
      </div>

      {warnings.length > 0 && batch.status === "awaiting_approval" && (
        <div className="mb-6 space-y-2 rounded-[12px] border border-warning/40 bg-warning-soft p-4 shadow-soft" role="status">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm font-medium text-warning">
              <WarningIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden /> {w}
            </p>
          ))}
        </div>
      )}
      {pending && (
        <section
          aria-labelledby="final-check-h"
          className={cx("mb-6 rounded-[12px] border p-4 shadow-soft", changes.length || unverified.length ? "border-danger/25 bg-danger-soft" : "border-success/25 bg-success-soft")}
        >
          <h2 id="final-check-h" className={cx("text-sm font-semibold", changes.length ? "text-danger" : "text-success")}>
            Final change check: {changes.length ? `${changes.length} claim${changes.length === 1 ? "" : "s"} changed since approval` : "nothing changed since approval"}
          </h2>
          {changes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-ink-2">
              {changes.map((c) => (
                <li key={c.claimId}>
                  <Link href={`/app/claims/${c.claimId}`} className="font-medium text-ink hover:underline">
                    #{c.number}
                  </Link>{" "}
                  {c.problems.join("; ")}
                </li>
              ))}
            </ul>
          )}
          {unverified.length > 0 && (
            <p className="mt-1 text-sm text-danger">
              Unverified PayPal receiver{unverified.length === 1 ? "" : "s"}: {unverified.join(", ")}.{" "}
              <Link href="/app/members" className="font-medium underline">
                Verify on Members
              </Link>
            </p>
          )}
          {!me?.canRelease && <p className="mt-1 text-xs text-ink-2">You don&apos;t have release authority, so the payout button is locked for you.</p>}
        </section>
      )}

      {batch.status === "unknown" ? (
        <div role="status" className="mb-6 rounded-[12px] border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
          <b>PayPal didn&apos;t answer in time.</b> The payout may already be on its way, so nothing will be resent and these claims stay locked.
          Verifying replays the same request id, which PayPal answers with the original result instead of paying twice.
        </div>
      ) : (
        batch.errorMessage && batch.status === "failed" && (
          <div role="alert" className="mb-6 rounded-[12px] border border-danger/25 bg-danger-soft p-4 text-sm text-danger">
            <b>PayPal error:</b> {batch.errorMessage.replace(/[.\s]+$/, "")}. Nothing was paid and the claims were released, so you can batch them again.
          </div>
        )
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-[12px] border border-line shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Recipient</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Claim</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map(({ item, claim }) => (
                  <tr key={item.id}>
                    <td className="px-3.5 py-3.5 sm:px-5">
                      <p className="font-medium">{item.receiverName}</p>
                      <p className="max-w-[150px] truncate text-xs text-muted sm:max-w-none" title={item.receiverEmail}>{item.receiverEmail}</p>
                      <Link href={`/app/claims/${claim.id}`} className="mt-1 block text-xs text-ink-2 hover:underline sm:hidden">
                        #{claim.number} {claimTitle(claim)}
                      </Link>
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <Link href={`/app/claims/${claim.id}`} className="hover:underline">
                        <span className="tnum text-muted">#{claim.number}</span> {claimTitle(claim)}
                      </Link>
                      <div className="mt-1">
                        <Confidence value={claim.aiConfidence} />
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 sm:px-5 text-right">
                      <Money cents={item.amountCents} currency={item.currency} className="font-medium" />
                    </td>
                    <td className="px-3.5 py-3.5 sm:px-5">
                      <StatusPill status={item.status} />
                      {item.transactionId && <p className="mt-1 font-mono text-[11px] text-muted">{item.transactionId}</p>}
                      {item.errorMessage && <p className="mt-1 text-[11px] text-danger">{item.errorMessage}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line-strong">
                <tr>
                  <th scope="row" className="px-3.5 py-3.5 sm:px-5 text-left text-[13px] font-medium text-ink-2">
                    Total to {recipients} {recipients === 1 ? "person" : "people"}
                  </th>
                  <td className="hidden sm:table-cell" />
                  <td className="px-3.5 py-3.5 sm:px-5 text-right">
                    <Money cents={batch.totalCents} currency={batch.currency} className="text-[15px] font-semibold" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-panel px-5 py-4">
            <p className="max-w-[46ch] text-xs leading-relaxed text-muted">
              {batch.paypalPayoutBatchId ? (
                <>
                  PayPal batch <span className="font-mono text-ink">{batch.paypalPayoutBatchId}</span>, sender id <span className="font-mono">{batch.id.slice(0, 8)}</span>
                </>
              ) : (
                <>Nothing is sent until an admin approves. Caps: {formatMoney(ws.maxSingleCents, batch.currency)} per person, {formatMoney(ws.maxBatchCents, batch.currency)} per batch.</>
              )}
            </p>
            <BatchActions batch={batch} recipients={recipients} isAdmin={ctx.isAdmin} blocked={blocked} mode={paypalMode()} />
          </div>
        </div>

        <div className="h-fit rounded-[12px] border border-line p-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">Timeline</h2>
          <ol className="mt-5">
            {timeline.map((t, i) => (
              <li key={t.label} className="relative flex gap-3 pb-6 last:pb-0">
                {i < timeline.length - 1 && (
                  <span className={cx("absolute top-5 left-[9px] h-[calc(100%-12px)] w-px", t.state === "done" ? "bg-success/50" : t.state === "failed" ? "bg-danger/40" : "bg-line")} aria-hidden />
                )}
                <span className={cx("relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", DOT[t.state])} aria-hidden>
                  {t.state === "failed" ? <XIcon className="size-3" weight="bold" /> : t.state === "skipped" ? <MinusIcon className="size-3" weight="bold" /> : <CheckIcon className="size-3" weight="bold" />}
                </span>
                <div>
                  <p className={cx("text-sm", t.state === "done" && "font-medium", t.state === "failed" && "font-medium text-danger", (t.state === "todo" || t.state === "skipped") && "text-muted")}>
                    {t.label}
                    <span className="sr-only"> ({t.state === "todo" ? "not yet" : t.state})</span>
                  </p>
                  {t.at && <p className="tnum text-xs text-muted">{t.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}
                  {i === 1 && t.state === "todo" && <p className="text-xs text-muted">Requires an owner or admin</p>}
                  {t.state === "skipped" && <p className="text-xs text-muted">Skipped</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
