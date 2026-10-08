import { and, desc, eq, inArray, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilePdfIcon, QuotesIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { ClaimEditor } from "@/components/claims/claim-editor";
import { EvidencePanel, type EvidenceRow } from "@/components/claims/evidence-panel";
import { Confidence, cx, Money, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { LOW_CONFIDENCE, workspaceMembers } from "@/lib/claims";
import { approvals, auditEvents, batches, batchItems, claimEvidence, claimPayments, claims, claimSplits, contexts, db, fixRequests, investigations, ledgerEntries, users } from "@/lib/db";
import { linesFor, obligationsFor } from "@/lib/ledger";
import { LinesCard } from "@/components/claims/lines-card";
import { CurrencyCard } from "@/components/claims/currency-card";
import { TrackingCard } from "@/components/claims/tracking-card";
import { FixRequests } from "@/components/claims/fix-requests";
import { RemindButton } from "@/components/claims/remind-button";
import { InvestigationPanel } from "@/components/claims/investigation-panel";
import { blockerFor } from "@/lib/reminders";
import { advancesWithSpend } from "@/lib/advances";
import { saasFindings } from "@/lib/exceptions";
import { SettlementCard } from "@/components/claims/settlement-card";
import { MoneyTimeline } from "@/components/claims/money-timeline";
import { ConfirmReceipt } from "@/components/claims/confirm-receipt";
import { factsFor } from "@/lib/claim-facts";
import { claimTimeline } from "@/lib/status";
import { Pill } from "@/components/ui";
import { openContradictions, payeesOf, riskSignalsFor } from "@/lib/approvals";
import { RiskSignals } from "@/components/claims/risk-signals";
import { hasHighRisk } from "@/lib/risk";
import { ConflictsPanel } from "@/components/claims/conflicts-panel";
import { DuplicateChooser } from "@/components/claims/duplicate-chooser";
import { MissingQuestionCard } from "@/components/claims/missing-question";
import { approvalBlocker } from "@/lib/policy";
import { FIELD_LABEL, FIELD_UNSURE, missingQuestions, suggestPurposes, uncertainFields } from "@/lib/evidence";
import { decisionBrief } from "@/lib/brief";
import { normalizeMerchant } from "@/lib/matching";
import { formatMoney } from "@/lib/money";
import { claimTitle } from "@/lib/title";
import { describe } from "@/lib/activity";
import { ClaimActions } from "@/components/claims/claim-actions";
import { ReceiptPreview } from "@/components/claims/receipt-preview";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

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
  const lineInfo = await linesFor(claim);
  const [ctxRows, fixRows, invRows, saas, riskMap] = await Promise.all([
    db.select().from(contexts).where(eq(contexts.workspaceId, ctx.workspace.id)),
    db.select().from(fixRequests).where(eq(fixRequests.claimId, id)),
    db.select().from(investigations).where(eq(investigations.claimId, id)).orderBy(desc(investigations.createdAt)),
    saasFindings(ctx.workspace.id),
    riskSignalsFor(ctx.workspace.id, [id]),
  ]);
  const risk = riskMap.get(id) ?? [];
  const name = (uid: string) => members.find((m) => m.id === uid)?.name ?? "Unknown";
  const saasNotes = [
    ...saas.personal.filter((p) => p.claimIds.includes(id)).map((p) => `${name(p.payerUserId)} has paid for ${p.vendor} personally in ${p.months.join(", ")}. Move it to the company card or a company account.`),
    ...saas.overlap.filter((o) => o.claimIds.includes(id)).map((o) => `${o.payerUserIds.map(name).join(" and ")} both bought ${o.vendor} in ${o.month}. Check whether one seat covers the team.`),
  ];
  // The viewer's own completed payouts on this claim, so they can confirm receipt.
  const myPaid = (
    await db.select().from(batchItems).where(and(eq(batchItems.claimId, id), eq(batchItems.receiverUserId, ctx.user.id), eq(batchItems.status, "SUCCESS")))
  ).filter((i) => !i.confirmedAt && !i.notReceivedAt);
  const activeApproval = approvalRows.find((a) => !a.invalidatedAt);
  const voided = !activeApproval ? approvalRows[0] : undefined;
  const blocker = approvalBlocker({ id: ctx.user.id, role: ctx.role! }, { submitterId: claim.submitterId, payeeIds: (await payeesOf(claim)).map((p) => p.userId) }, ctx.workspace.alternateApproverId);
  const receipt = claim.receiptKey ? { src: `/api/v1/claims/${claim.id}/receipt`, mime: claim.receiptMime ?? "", filename: claim.receiptName ?? "receipt" } : null;
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

  const approvableNow = claim.status === "pending_review" && !blocker;
  const approvable = claim.status === "pending_review" || (claim.status === "in_batch" && !activeApproval && batchRow?.batch.status === "awaiting_approval");
  const title = claimTitle(claim);
  const trail = await db
    .select({ e: auditEvents, actor: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(and(eq(auditEvents.workspaceId, ctx.workspace.id), eq(auditEvents.entityId, claim.id)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(5);
  const waiting = blockerFor(truth, {
    missing: missingQuestions(claim, { kinds: evidence_.map((e) => e.kind), receiptRequiredCents: ctx.workspace.receiptRequiredCents }).map((q) => q.question),
    contradictions: conflicts.map((c) => c.message),
    duplicate: !!claim.duplicateOfId,
    batchName: batchRow?.batch.name,
  });
  const payerHistory = approvableNow
    ? await db.select().from(claims).where(and(eq(claims.workspaceId, ctx.workspace.id), eq(claims.payerUserId, claim.payerUserId), ne(claims.id, claim.id)))
    : [];
  const brief = approvableNow
    ? decisionBrief({
        amountCents: claim.amountCents,
        currency: claim.currency,
        approvableCents: obligations.reimbursableCents,
        vendor: claim.vendor,
        purpose: claim.purpose,
        payer: name(claim.payerUserId),
        evidenceKinds: evidence_.map((e) => e.kind),
        missing: missingQuestions(claim, { kinds: evidence_.map((e) => e.kind), receiptRequiredCents: ctx.workspace.receiptRequiredCents }).map((q) => q.question),
        contradictions: conflicts.map((c) => c.message),
        uncertainFields: uncertainFields(ai?.field_confidence).map((f) => FIELD_LABEL[f]?.toLowerCase() ?? f),
        duplicateOf: claim.duplicateOfId ? (match?.candidates?.find((c) => c.id === claim.duplicateOfId)?.number ?? null) : null,
        maxSingleCents: ctx.workspace.maxSingleCents,
        receiptRequiredCents: ctx.workspace.receiptRequiredCents,
        merchantHistoryCents: payerHistory
          .filter((h) => ["matched", "in_batch", "partially_paid", "paid"].includes(h.status) && normalizeMerchant(h.vendor) && normalizeMerchant(h.vendor) === normalizeMerchant(claim.vendor))
          .map((h) => h.amountCents),
        firstClaimByPayer: payerHistory.length === 0,
        receiptCurrency: claim.receiptCurrency,
      })
    : null;

  const actions = { claimId: claim.id, canApprove: approvable && (ctx.isAdmin || !blocker), approveBlocked: blocker?.message ?? null, canReject: ctx.isAdmin && ["draft", "pending_review", "matched"].includes(claim.status), needsRiskAck: hasHighRisk(risk) };
  const attendees = (claim.attendeeNames ?? []).filter(Boolean);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/app/claims" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink md:min-h-0">
          <ArrowLeftIcon className="size-3.5" aria-hidden /> Claims
        </Link>
        <Link href={`/app/claims/${claim.id}/record`} className="inline-flex min-h-11 items-center text-[13px] text-muted transition-colors hover:text-ink md:min-h-0">
          Closure record
        </Link>
      </div>

      {/* Sticky summary: what it is, how much, where it stands, and the decision. */}
      <header className="sticky top-0 z-20 -mx-4 mb-8 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={truth.tone} dot>
                {truth.label}
              </Pill>
              <span className="text-[13px] text-muted">
                <span className="font-mono">#{claim.number}</span> from {name(claim.submitterId)} via {SOURCE[claim.source]}
              </span>
            </div>
            <h1 className="mt-1.5 break-words text-[22px] font-semibold tracking-[-0.03em] sm:text-[26px]">
              {title}
              {!claim.vendor.trim() && <span className="ml-2 align-middle text-[13px] font-medium tracking-normal text-warning">Add vendor</span>}
            </h1>
            <p className="mt-0.5 text-[13px] text-muted">
              Reimburses {name(claim.payerUserId)}
              {splits.length > 0 && <> · split with {splits.map((x) => name(x.userId)).join(", ")}</>}
              {attendees.length > 0 && <> · also with {attendees.join(", ")} (not in this workspace)</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Money cents={claim.amountCents} currency={claim.currency} className="text-[30px] leading-none font-semibold sm:text-[36px]" />
            <div className="hidden flex-col items-end md:flex">
              <ClaimActions {...actions} variant="inline" />
            </div>
          </div>
        </div>
      </header>

      {/* Phones: the decision stays under the thumb, above the tab bar. */}
      {(actions.canApprove || actions.canReject) && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-panel/95 px-4 py-2.5 backdrop-blur md:hidden">
          <ClaimActions {...actions} variant="bar" />
        </div>
      )}

      {/* Phones: receipt first (order-first), then the brief and anything that needs a decision. */}
      <div className="flex flex-col">
      {brief && (
        <section aria-labelledby="brief-h" className="rise mb-8 rounded-[12px] border border-line bg-panel p-5 shadow-soft">
          <p id="brief-h" className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
            Decision brief
          </p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.015em]">{brief.headline}</p>
          <p className="mt-1 text-[13px] text-muted">Evidence: {brief.evidence}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-ink-2">Gaps</p>
              {brief.gaps.length ? (
                <ul className="mt-1 list-disc pl-4 text-[13px] text-danger">
                  {brief.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13px] text-success">None</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-ink-2">Unusual</p>
              {brief.unusual.length ? (
                <ul className="mt-1 list-disc pl-4 text-[13px] text-warning">
                  {brief.unusual.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13px] text-success">Nothing unusual</p>
              )}
            </div>
          </div>
        </section>
      )}
      {["pending_review", "matched", "in_batch"].includes(claim.status) && <RiskSignals claimId={claim.id} signals={risk} canAcknowledge={actions.canApprove} />}

      {(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status) && (
        <MissingQuestionCard
          claimId={claim.id}
          questions={missingQuestions(claim, { kinds: evidence_.map((e) => e.kind), receiptRequiredCents: ctx.workspace.receiptRequiredCents })}
          canDeclare={[claim.submitterId, claim.payerUserId].includes(ctx.user.id)}
          receiptRequired={formatMoney(ctx.workspace.receiptRequiredCents, claim.currency)}
          suggestions={suggestPurposes(claim.txnDate, ctxRows)}
        />
      )}
      {saasNotes.map((n) => (
        <p key={n} className="mb-4 rounded-[10px] border border-accent/25 bg-accent-soft px-4 py-3 text-[13px] text-ink-2">
          {n}
        </p>
      ))}
      <InvestigationPanel
        canAct={ctx.isAdmin}
        rows={invRows.map((r) => ({ id: r.id, reason: r.reason, openedBy: name(r.openedBy), notes: r.notes.map((n) => ({ ...n, by: name(n.by) })), status: r.status, outcome: r.outcome }))}
      />
      <FixRequests
        claimId={claim.id}
        rows={fixRows.map((r) => ({ id: r.id, field: r.field, message: r.message, by: name(r.requestedBy), reply: r.reply, resolved: !!r.resolvedAt }))}
        canRequest={claim.status === "pending_review" && !blocker}
        canReply={[claim.submitterId, claim.payerUserId].includes(ctx.user.id)}
      />
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

      {/* Receipt and what was read, side by side. */}
      {(receipt || claim.rawText || evidence.length > 0 || ai) && (
        <div className="order-first mb-10 grid gap-6 md:order-none lg:grid-cols-2">
          <div>
            {receipt ? (
              <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[12px] border border-line bg-sunken p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]">
                {receipt.mime.startsWith("image/") ? (
                  <ReceiptPreview src={receipt.src} alt={`Receipt ${receipt.filename}`} />
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
          </div>
          <div>
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
        </div>
      )}
      </div>

      <div className="grid gap-8 pb-20 md:pb-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
              approvable={approvable}
            />
            {activeApproval ? (
              <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-2">
                {claim.status === "pending_review" ? "Signed off by " : "Approved by "}
                {approvalRows
                  .filter((a) => !a.invalidatedAt)
                  .map((a) => `${name(a.approverId)}${a.onBehalfOfId ? ` (covering for ${name(a.onBehalfOfId)})` : ""}`)
                  .join(" and ")}{" "}
                on {activeApproval.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.
                {claim.status === "pending_review" ? " It still needs another approver with enough authority." : " Changing the amount, recipient or evidence voids it."}
              </p>
            ) : voided?.invalidReason ? (
              <p className="mt-4 rounded-[8px] border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
                Approval by {name(voided.approverId)} was voided: {voided.invalidReason}. It needs a fresh approval.
              </p>
            ) : null}
          </section>

          <LinesCard
            claimId={claim.id}
            currency={claim.currency}
            rows={lineInfo.rows.map((r) => ({ ...r, excludeReason: "excludeReason" in r ? (r.excludeReason as string | null) : null, decisionNote: "decisionNote" in r ? (r.decisionNote as string | null) : null }))}
            extrasCents={lineInfo.extrasCents}
            canEdit={(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status)}
            canDecide={!blocker && ["pending_review", "matched", "partially_paid", "failed"].includes(claim.status)}
          />
          {claim.adjustmentCents > 0 && (
            <p className="rounded-[8px] border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
              Approved <Money cents={claim.amountCents - claim.adjustmentCents} currency={claim.currency} /> of <Money cents={claim.amountCents} currency={claim.currency} />. {claim.adjustmentReason}
            </p>
          )}

          <EvidencePanel
            claimId={claim.id}
            viewerId={ctx.user.id}
            canShareStatement={[claim.submitterId, claim.payerUserId].includes(ctx.user.id) && !["paid", "rejected"].includes(claim.status)}
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
              addedById: e.addedBy,
              privateFile: e.privateFile,
              redactedCount: e.redactedCount,
              createdAt: e.createdAt.toISOString(),
            }))}
          />
        </div>

        <div className="space-y-4">
          <MoneyTimeline truth={truth} steps={claimTimeline(facts)}>
            {waiting && (
              <div className="mt-4 border-t border-line pt-4 text-[13px]">
                <p>
                  <span className="text-muted">Waiting on the {waiting.waitingOn}:</span> {waiting.why}
                </p>
                <p className="font-medium text-accent">{waiting.action}</p>
                {claim.escalatedToUserId && (
                  <p className="mt-1 text-xs text-warning">
                    Escalated to {name(claim.escalatedToUserId)} on {claim.escalatedAt?.toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </p>
                )}
                <RemindButton claimId={claim.id} />
              </div>
            )}
            {myPaid.map((i) => (
              <ConfirmReceipt key={i.id} itemId={i.id} amount={formatMoney(i.amountCents, i.currency)} />
            ))}
          </MoneyTimeline>

          <section aria-labelledby="trail-h" className="rounded-[12px] border border-line bg-panel p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="trail-h" className="text-[15px] font-semibold tracking-[-0.015em]">
                Audit trail
              </h2>
              <Link href="/app/activity?type=claim" className="inline-flex min-h-11 items-center text-[13px] text-accent hover:underline md:min-h-0">
                View all
              </Link>
            </div>
            {trail.length ? (
              <ol className="space-y-2.5">
                {trail.map(({ e, actor }) => (
                  <li key={e.id} className="text-[13px] leading-snug">
                    <span className="font-medium">{actor ?? "System"}</span> <span className="text-ink-2">{describe(e.action)}</span>
                    <span className="tnum block text-xs text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted">No events yet.</p>
            )}
          </section>

          <section aria-label="Payout batch">
            <div className="overflow-hidden rounded-[12px] border border-line bg-panel shadow-soft">
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

          <details className="group rounded-[12px] border border-line bg-panel shadow-soft">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
              Settlement details
              <CaretDownIcon className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-line p-4">
              <SettlementCard
                claimId={claim.id}
                currency={claim.currency}
                totalCents={claim.amountCents}
                o={obligations}
                payments={payments}
                entries={ledger.map((e) => ({ id: e.id, kind: e.kind, userId: e.userId, amountCents: e.amountCents, reference: e.reference, createdAt: e.createdAt.toISOString() }))}
                members={members}
                participants={splits.map((x) => name(x.userId))}
                participantIds={splits.map((x) => x.userId)}
                budgetOwnerId={claim.budgetOwnerUserId}
                canEditPeople={(ctx.isAdmin || claim.submitterId === ctx.user.id) && !["paid", "rejected"].includes(claim.status)}
                approvedBy={activeApproval ? name(activeApproval.approverId) : null}
                canEditFunding={(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status)}
                canRecord={ctx.isAdmin && ["matched", "partially_paid", "paid", "failed"].includes(claim.status)}
                advanceOptions={(await advancesWithSpend(ctx.workspace.id))
                  .filter((a) => a.status === "open" && a.currency === claim.currency)
                  .map((a) => ({ id: a.id, label: `${name(a.userId)}: ${a.purpose} (${formatMoney(a.leftCents, a.currency)} left)` }))}
              />
            </div>
          </details>
          <details className="group rounded-[12px] border border-line bg-panel shadow-soft">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
              Currency and conversion
              <CaretDownIcon className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-line p-4">
              <CurrencyCard
                claimId={claim.id}
                receipt={{ cents: claim.receiptCents ?? claim.amountCents, currency: claim.receiptCurrency ?? claim.currency }}
                charged={claim.chargedCents != null ? { cents: claim.chargedCents, currency: claim.chargedCurrency ?? claim.currency } : null}
                reimbursed={{ cents: claim.amountCents, currency: claim.currency }}
                fx={{ rate: claim.fxRate, source: claim.fxSource, at: claim.fxAt?.toISOString() ?? null }}
                canEdit={(ctx.isAdmin || claim.submitterId === ctx.user.id) && ["draft", "pending_review", "matched"].includes(claim.status)}
              />
            </div>
          </details>
          <details className="group rounded-[12px] border border-line bg-panel shadow-soft">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
              Deposit and client billing
              <CaretDownIcon className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-line p-4">
              <TrackingCard
                claimId={claim.id}
                kind={claim.kind}
                depositStatus={claim.depositStatus}
                depositNote={claim.depositNote}
                recoverableClient={claim.recoverableClient}
                recoveryStatus={claim.recoveryStatus}
                recoveryRef={claim.recoveryRef}
                canEdit={(ctx.isAdmin || claim.submitterId === ctx.user.id) && claim.status !== "rejected"}
                isAdmin={ctx.isAdmin}
              />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
