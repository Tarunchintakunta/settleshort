import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { BatchActions } from "@/components/batches/batch-actions";
import { Confidence, cx, Money, Pill, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { LOW_CONFIDENCE } from "@/lib/claims";
import { auditEvents, batches, batchItems, claims, db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { paypalMode } from "@/lib/paypal";

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
  const warnings: string[] = [];
  const low = items.filter((i) => i.claim.aiConfidence != null && i.claim.aiConfidence < LOW_CONFIDENCE);
  if (low.length) warnings.push(`${low.length} claim(s) have low AI confidence: ${low.map((l) => "#" + l.claim.number).join(", ")}`);
  const overSingle = items.filter((i) => i.item.amountCents > ws.maxSingleCents);
  if (overSingle.length) warnings.push(`${overSingle.length} payout(s) exceed the single-payout cap of ${formatMoney(ws.maxSingleCents, batch.currency)}`);
  if (batch.totalCents > ws.maxBatchCents) warnings.push(`Batch total exceeds the cap of ${formatMoney(ws.maxBatchCents, batch.currency)}`);
  const blocked = overSingle.length || batch.totalCents > ws.maxBatchCents ? "Over the safety caps. Adjust them in Settings." : null;
  const recipients = new Set(items.map((i) => i.item.receiverEmail)).size;

  const at = (action: string) => events.find((e) => e.action === action)?.createdAt;
  const done = ["completed", "partial", "failed"].includes(batch.status);
  const timeline = [
    { label: "Batch created", at: batch.createdAt, done: true },
    { label: "Approved by a human", at: batch.approvedAt, done: !!batch.approvedAt },
    { label: "Sent to PayPal Payouts", at: at("payout.created"), done: !!batch.paypalPayoutBatchId },
    { label: batch.status === "failed" ? "Failed" : batch.status === "partial" ? "Partially paid" : "Paid", at: at(`batch.${batch.status}`), done },
  ];

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
      {batch.errorMessage && (
        <div role="alert" className="mb-6 rounded-[12px] border border-danger/25 bg-danger-soft p-4 text-sm text-danger">
          <b>PayPal error:</b> {batch.errorMessage}. The claims were released, so you can batch them again.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-[12px] border border-line shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Recipient</th>
                  <th className="px-5 py-3 font-medium">Claim</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map(({ item, claim }) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{item.receiverName}</p>
                      <p className="text-xs text-muted">{item.receiverEmail}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/app/claims/${claim.id}`} className="hover:underline">
                        <span className="font-mono text-muted">#{claim.number}</span> {claim.vendor}
                      </Link>
                      <div className="mt-1">
                        <Confidence value={claim.aiConfidence} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Money cents={item.amountCents} currency={item.currency} className="font-medium" />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={item.status} />
                      {item.transactionId && <p className="mt-1 font-mono text-[11px] text-muted">{item.transactionId}</p>}
                      {item.errorMessage && <p className="mt-1 text-[11px] text-danger">{item.errorMessage}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-sunken px-5 py-4">
            <p className="text-xs text-muted">
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
                  <span className={cx("absolute top-5 left-[9px] h-[calc(100%-12px)] w-px", t.done ? "bg-success/50" : "bg-line")} aria-hidden />
                )}
                <span
                  className={cx(
                    "relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    t.done ? "border-success bg-success text-on-success" : "border-line-strong bg-panel text-transparent",
                  )}
                  aria-hidden
                >
                  <CheckIcon className="size-3" weight="bold" />
                </span>
                <div>
                  <p className={cx("text-sm", t.done ? "font-medium" : "text-muted")}>{t.label}</p>
                  {t.at && <p className="tnum text-xs text-muted">{t.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}
                  {i === 1 && !t.done && <p className="text-xs text-muted">Requires an owner or admin</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
