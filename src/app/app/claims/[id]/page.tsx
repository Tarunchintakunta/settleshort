import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilePdfIcon, QuotesIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { ClaimEditor } from "@/components/claims/claim-editor";
import { EvidencePanel, type EvidenceRow } from "@/components/claims/evidence-panel";
import { Confidence, cx, Money, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { LOW_CONFIDENCE, workspaceMembers } from "@/lib/claims";
import { approvals, batches, batchItems, claimEvidence, claimPayments, claims, claimSplits, db, ledgerEntries } from "@/lib/db";
import { obligationsFor } from "@/lib/ledger";
import { SettlementCard } from "@/components/claims/settlement-card";
import { MoneyTimeline } from "@/components/claims/money-timeline";
import { ConfirmReceipt } from "@/components/claims/confirm-receipt";
import { factsFor } from "@/lib/claim-facts";
import { claimTimeline } from "@/lib/status";
import { Pill } from "@/components/ui";
import { openContradictions, payeesOf } from "@/lib/approvals";
import { ConflictsPanel } from "@/components/claims/conflicts-panel";
import { DuplicateChooser } from "@/components/claims/duplicate-chooser";
import { MissingQuestionCard } from "@/components/claims/missing-question";
import { approvalBlocker } from "@/lib/policy";
import { FIELD_UNSURE, missingQuestions, uncertainFields } from "@/lib/evidence";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Claim" };

type Ai = { provider?: string; field_confidence?: Record<string, number>; evidence?: Record<string, string>; ocr_text?: string; line_items?: { name: string; amount_cents: number }[] } & Record<string, unknown>;
type MatchJson = { rationale?: string; ambiguous?: boolean; candidates?: { id: string; number?: number; score: number; reasons: string[] }[] };

const SOURCE: Record<string, string> = { upload: "receipt upload", slack: "Slack", email: "email", manual: "message" };

export default async function ClaimPage({ params }: PageProps<"/app/claims/[id]">) {
  const { id } = await params;
  const ctx = await requirePageCtx();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!claim) notFound();

  const [members, splits, batchRow, evidence_, approvalRows, payments, ledger, obligations] = await Promise.all([
    workspaceMembers(ctx.workspace.id),
    db.select().from(claimSplits).where(eq(claimSplits.claimId, id)),
    db.select({ item: batchItems, batch: batches }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(eq(batchItems.claimId, id)).then((r) => r.at(-1)),
    db.select().from(claimEvidence).where(eq(claimEvidence.claimId, id)).orderBy(claimEvidence.createdAt),
    db.select().from(approvals).where(eq(approvals.claimId, id)).orderBy(desc(approvals.createdAt)),
    db.select().from(claimPayments).where(eq(claimPayments.claimId, id)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.claimId, id)).orderBy(ledgerEntries.createdAt),
    obligationsFor(claim),
  ]);
  const { facts, truth } = (await factsFor([claim])).get(claim.id)!;
  const conflicts = await openContradictions(claim);
  // The viewer's own completed payouts on this claim, so they can confirm receipt.
  const myPaid = (
    await db.select().from(batchItems).where(and(eq(batchItems.claimId, id), eq(batchItems.receiverUserId, ctx.user.id), eq(batchItems.status, "SUCCESS")))
  ).filter((i) => !i.confirmedAt && !i.notReceivedAt);
  const activeApproval = approvalRows.find((a) => !a.invalidatedAt);
  const voided = !activeApproval ? approvalRows[0] : undefined;
  const blocker = approvalBlocker({ id: ctx.user.id, role: ctx.role! }, { submitterId: claim.submitterId, payeeIds: (await payeesOf(claim)).map((p) => p.userId) }, ctx.workspace.alternateApproverId);
  const receipt = claim.receiptKey ? { src: `/api/v1/claims/${claim.id}/receipt`, mime: claim.receiptMime ?? "", filename: claim.receiptName ?? "receipt" } : null;
  const name = (uid: string) => members.find((m) => m.id === uid)?.name ?? "Unknown";
  const ai = claim.aiJson as Ai | null;
  const match = claim.matchJson as MatchJson | null;
  const evidence = Object.entries(ai?.evidence ?? {}).filter(([, v]) => v);
  // Strong candidates only: the flagged one, plus a close second when the match is ambiguous.
  const candIds = (match?.candidates ?? []).filter((c) => c.id === claim.duplicateOfId || (match?.ambiguous && c.score >= 0.6)).map((c) => c.id);
  const candRows = candIds.length ? await db.select().from(claims).where(and(eq(claims.workspaceId, ctx.workspace.id), inArray(claims.id, candIds))) : [];
  const dupCandidates = (match?.candidates ?? []).flatMap((m) => {
    const c = candRows.find((r) => r.id === m.id);
    return c ? [{ id: c.id, number: c.number, vendor: c.vendor, amountCents: c.amountCents, currency: c.currency, txnDate: c.txnDate, payer: name(c.payerUserId), score: m.score, reasons: m.reasons }] : [];
  });

  return (
    <>
      <Link href="/app/claims" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink">
        <ArrowLeftIcon className="size-3.5" aria-hidden /> Claims
      </Link>
      <Link href={`/app/claims/${claim.id}/record`} className="mb-6 ml-4 inline-flex text-[13px] text-muted transition-colors hover:text-ink">
        Closure record
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={truth.tone} dot>
              {truth.label}
            </Pill>
            <span className="text-[13px] text-muted">
              <span className="font-mono">#{claim.number}</span> from {name(claim.submitterId)} via {SOURCE[claim.source]}
            </span>
          </div>
          <h1 className="mt-3 break-words text-[26px] font-semibold tracking-[-0.03em] sm:text-[28px]">{claim.vendor || "Untitled claim"}</h1>
        </div>
        <div className="text-left sm:text-right">
          <Money cents={claim.amountCents} currency={claim.currency} className="text-[40px] leading-none font-semibold sm:text-[44px]" />
          <p className="mt-1 text-[13px] text-muted">Reimburses {name(claim.payerUserId)}</p>
        </div>
      </header>

      {(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status) && (
        <MissingQuestionCard claimId={claim.id} questions={missingQuestions(claim)} />
      )}
      <ConflictsPanel claimId={claim.id} conflicts={conflicts} canResolve={ctx.isAdmin} />

      {claim.duplicateOfId && dupCandidates.length > 0 && (
        <section className="rise mb-8 rounded-[12px] border border-warning/30 bg-warning-soft p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <WarningIcon className="size-4" weight="fill" aria-hidden /> {match?.ambiguous ? "Matches more than one claim" : "Possible duplicate"}
          </p>
          {match?.rationale && <p className="mt-1.5 text-sm text-ink-2">{match.rationale}</p>}
          <DuplicateChooser claimId={claim.id} candidates={dupCandidates} ambiguous={!!match?.ambiguous} canDecide={ctx.isAdmin && ["pending_review", "matched"].includes(claim.status)} />
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {receipt ? (
            <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[12px] border border-line bg-sunken p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
              {receipt.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receipt.src} alt={`Receipt ${receipt.filename}`} className="max-h-[560px] w-auto rounded-[8px] shadow-pop" />
              ) : (
                <a href={receipt.src} target="_blank" className="flex flex-col items-center gap-3 text-muted hover:text-ink">
                  <FilePdfIcon className="size-14" weight="light" aria-hidden />
                  <span className="text-sm">Open {receipt.filename}</span>
                </a>
              )}
            </div>
          ) : claim.rawText ? (
            <div className="rounded-[12px] border border-line bg-panel p-5 shadow-soft">
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Original message</p>
              <p className="mt-3 text-[15px] leading-relaxed">{claim.rawText}</p>
            </div>
          ) : null}

          {(evidence.length > 0 || ai) && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em]">What was read</h2>
                <Confidence value={claim.aiConfidence} provider={ai?.provider} />
              </div>
              {evidence.length > 0 && (
                <ul className="space-y-2">
                  {evidence.map(([k, v]) => (
                    <li key={k} className="rounded-[8px] border border-line bg-sunken/70 px-3 py-2.5">
                      <p className="flex justify-between text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
                        {k}
                        {ai?.field_confidence?.[k === "total" ? "amount" : k] != null && (
                          <span className={cx("tnum font-mono normal-case tracking-normal", ai.field_confidence[k === "total" ? "amount" : k] < FIELD_UNSURE && "text-warning")}>
                            {Math.round(ai.field_confidence[k === "total" ? "amount" : k] * 100)}% sure
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 font-mono text-[13px] leading-relaxed text-ink">
                        <QuotesIcon className="mt-0.5 size-3 shrink-0 text-muted" weight="fill" aria-hidden />
                        <span className="break-words">{v}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3 text-[13px]">
                <summary className="cursor-pointer text-muted hover:text-ink">Raw extraction JSON</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-[8px] border border-line bg-sunken p-3 font-mono text-[11.5px] leading-relaxed">{JSON.stringify({ ...ai, ocr_text: undefined, match }, null, 2)}</pre>
                {ai?.ocr_text && <pre className="mt-2 max-h-48 overflow-auto rounded-[8px] border border-line bg-sunken p-3 font-mono text-[11.5px] leading-relaxed">{ai.ocr_text}</pre>}
              </details>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section className="rounded-[12px] border border-line p-5 shadow-soft sm:p-6">
            <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.015em]">Details</h2>
            <ClaimEditor
              claim={claim}
              members={members}
              isAdmin={ctx.isAdmin}
              canEdit={ctx.isAdmin || claim.submitterId === ctx.user.id}
              lowConfidence={claim.aiConfidence != null && claim.aiConfidence < LOW_CONFIDENCE}
              approveBlocked={blocker?.message ?? null}
              uncertain={uncertainFields(ai?.field_confidence)}
              approvable={claim.status === "pending_review" || (claim.status === "in_batch" && !activeApproval && batchRow?.batch.status === "awaiting_approval")}
            />
            {activeApproval ? (
              <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-2">
                Approved by <b className="text-ink">{name(activeApproval.approverId)}</b> on{" "}
                {activeApproval.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Changing the amount, recipient or evidence voids it.
              </p>
            ) : voided?.invalidReason ? (
              <p className="mt-4 rounded-[8px] border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
                Approval by {name(voided.approverId)} was voided: {voided.invalidReason}. It needs a fresh approval.
              </p>
            ) : null}
          </section>

          {(ai?.line_items?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.015em]">Line items</h2>
              <ul className="divide-y divide-line rounded-[12px] border border-line px-4 text-sm">
                {ai!.line_items!.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-ink-2">{l.name}</span>
                    <Money cents={l.amount_cents} currency={claim.currency} />
                  </li>
                ))}
                {claim.taxCents > 0 && (
                  <li className="flex justify-between py-2 text-muted">
                    <span>Tax</span>
                    <span className="money">{formatMoney(claim.taxCents, claim.currency)}</span>
                  </li>
                )}
                {claim.tipCents > 0 && (
                  <li className="flex justify-between py-2 text-muted">
                    <span>Tip</span>
                    <span className="money">{formatMoney(claim.tipCents, claim.currency)}</span>
                  </li>
                )}
              </ul>
            </section>
          )}

          <MoneyTimeline truth={truth} steps={claimTimeline(facts)}>
            {myPaid.map((i) => (
              <ConfirmReceipt key={i.id} itemId={i.id} amount={formatMoney(i.amountCents, i.currency)} />
            ))}
          </MoneyTimeline>

          <EvidencePanel
            claimId={claim.id}
            describeChange={Object.fromEntries(
              evidence_.flatMap((e) => {
                const x = e.extractJson as { correction?: boolean; from?: Record<string, unknown>; to?: Record<string, unknown> } | null;
                if (!x?.correction || !x.to) return [];
                const show = (k: string, v: unknown) =>
                  k === "payerUserId" ? name(String(v)) : k === "amountCents" ? formatMoney(Number(v), String(x.to?.currency ?? claim.currency)) : String(v ?? "none");
                const LABEL: Record<string, string> = { payerUserId: "Paid by", amountCents: "Amount", vendor: "Merchant", txnDate: "Date", currency: "Currency" };
                return [[e.id, Object.keys(x.to).map((k) => `${LABEL[k] ?? k}: ${show(k, x.from?.[k])} → ${show(k, x.to![k])}`).join(" · ")]];
              }),
            )}
            canAdd={(ctx.isAdmin || claim.submitterId === ctx.user.id) && !["paid", "rejected"].includes(claim.status)}
            rows={evidence_.map((e) => ({
              id: e.id,
              kind: e.kind,
              source: e.source,
              fileName: e.fileName,
              fileMime: e.fileMime,
              rawText: e.rawText,
              extract: e.extractJson as EvidenceRow["extract"],
              addedBy: e.addedBy ? name(e.addedBy) : "System",
              createdAt: e.createdAt.toISOString(),
            }))}
          />

          <section aria-labelledby="settlement-h">
            <h2 id="settlement-h" className="mb-2 text-[15px] font-semibold tracking-[-0.015em]">
              Settlement
            </h2>
            <SettlementCard
              claimId={claim.id}
              currency={claim.currency}
              totalCents={claim.amountCents}
              o={obligations}
              payments={payments}
              entries={ledger.map((e) => ({ id: e.id, kind: e.kind, userId: e.userId, amountCents: e.amountCents, reference: e.reference, createdAt: e.createdAt.toISOString() }))}
              members={members}
              participants={splits.map((x) => name(x.userId))}
              approvedBy={activeApproval ? name(activeApproval.approverId) : null}
              canEditFunding={(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status)}
              canRecord={ctx.isAdmin && ["matched", "partially_paid", "paid", "failed"].includes(claim.status)}
            />
            <div className="mt-3 overflow-hidden rounded-[12px] border border-line bg-panel shadow-soft">
              {batchRow ? (
                <Link
                  href={`/app/batches/${batchRow.batch.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-sunken"
                >
                  <span className="min-w-0">
                    <span className="text-muted">Batch </span>
                    <span className="font-medium">{batchRow.batch.name}</span>
                    {batchRow.item.transactionId && <span className="ml-2 font-mono text-xs break-all text-muted">{batchRow.item.transactionId}</span>}
                  </span>
                  <StatusPill status={batchRow.item.status} />
                </Link>
              ) : (
                <p className="px-4 py-3 text-xs text-muted">
                  {claim.status === "matched" ? "Approved. Goes into the next settlement batch." : claim.status === "rejected" ? "Rejected, so it won't be paid." : "Not in a settlement batch yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
