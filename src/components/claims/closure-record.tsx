import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { Money } from "@/components/ui";
import { describe } from "@/lib/activity";
import { factsFor } from "@/lib/claim-facts";
import { workspaceMembers } from "@/lib/claims";
import { approvals, auditEvents, batches, batchItems, claimEvidence, claims, db, ledgerEntries } from "@/lib/db";
import { obligationsFor } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { claimTitle } from "@/lib/title";

const when = (d: Date | null | undefined) => (d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "");

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 border-b border-line pb-1 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{children}</h2>;
}

/** One readable, printable history of a claim: evidence, approvals, adjustments and payout references. */
export async function ClosureRecord({ id, workspace, back = true }: { id: string; workspace: { id: string; name: string }; back?: boolean }) {
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, workspace.id)));
  if (!claim) return null;
  const [members, evidence, appr, ledger, items, events, o, facts] = await Promise.all([
    workspaceMembers(workspace.id),
    db.select().from(claimEvidence).where(eq(claimEvidence.claimId, id)).orderBy(asc(claimEvidence.createdAt)),
    db.select().from(approvals).where(eq(approvals.claimId, id)).orderBy(asc(approvals.createdAt)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.claimId, id)).orderBy(asc(ledgerEntries.createdAt)),
    db.select({ item: batchItems, batch: batches }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(eq(batchItems.claimId, id)).orderBy(asc(batches.createdAt)),
    db.select().from(auditEvents).where(and(eq(auditEvents.entityId, id), eq(auditEvents.workspaceId, workspace.id))).orderBy(asc(auditEvents.createdAt)),
    obligationsFor(claim),
    factsFor([claim]),
  ]);
  const name = (u: string | null) => (u ? members.find((m) => m.id === u)?.name ?? "Unknown" : "System");
  const truth = facts.get(id)!.truth;

  return (
    <article className="mx-auto max-w-3xl text-sm print:max-w-none">
      {back && (
        <Link href={`/app/claims/${id}`} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink print:hidden">
          <ArrowLeftIcon className="size-3.5" aria-hidden /> Claim
        </Link>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">
            {workspace.name} · closure record · generated {when(new Date())}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">
            #{claim.number} {claimTitle(claim)}
          </h1>
          <p className="text-muted">
            {claim.txnDate ?? "No date"} · submitted by {name(claim.submitterId)} · status: {truth.label}
          </p>
        </div>
        <Money cents={claim.amountCents} currency={claim.currency} className="text-[28px] font-semibold" />
      </header>

      <H>Evidence</H>
      <ul className="space-y-1">
        {evidence.map((e) => (
          <li key={e.id}>
            {e.kind} via {e.source} · {name(e.addedBy)} · {when(e.createdAt)}
            {e.fileName && <span className="ml-1 font-mono text-xs">{e.fileName}</span>}
            {e.rawText && <span className="ml-1 text-ink-2">&ldquo;{e.rawText}&rdquo;</span>}
          </li>
        ))}
        {!evidence.length && <li className="text-muted">No evidence attached.</li>}
      </ul>

      <H>Approvals</H>
      <ul className="space-y-1">
        {appr.map((a) => (
          <li key={a.id}>
            {name(a.approverId)} approved {formatMoney((a.snapshotJson as { amountCents: number }).amountCents, claim.currency)} on {when(a.createdAt)}
            {a.invalidatedAt ? <span className="text-warning"> · voided {when(a.invalidatedAt)}: {a.invalidReason}</span> : <span className="text-success"> · in force</span>}
            <span className="ml-1 font-mono text-[11px] text-muted">{a.snapshotHash.slice(0, 12)}</span>
          </li>
        ))}
        {!appr.length && <li className="text-muted">Never approved.</li>}
      </ul>

      <H>What was owed</H>
      <p>
        Total {formatMoney(o.totalCents, claim.currency)} · employee-funded {formatMoney(o.employeeFundedCents, claim.currency)} · company card {formatMoney(o.companyFundedCents, claim.currency)} · advance{" "}
        {formatMoney(o.advanceFundedCents, claim.currency)} · excluded {formatMoney(o.excludedCents, claim.currency)}
      </p>
      <ul className="mt-1 space-y-1">
        {o.payees.map((p) => (
          <li key={p.userId}>
            {name(p.userId)}: owed {formatMoney(p.owedCents, claim.currency)}, settled {formatMoney(p.settledCents, claim.currency)}, remaining {formatMoney(p.outstandingCents, claim.currency)}
          </li>
        ))}
      </ul>

      <H>Adjustments and payments</H>
      <ul className="space-y-1">
        {ledger.map((l) => (
          <li key={l.id}>
            {when(l.createdAt)} · {l.kind.replace(/_/g, " ")} · {name(l.userId)} · {formatMoney(l.amountCents, l.currency)}
            {l.reference && <span className="ml-1 font-mono text-xs">{l.reference}</span>}
          </li>
        ))}
        {!ledger.length && <li className="text-muted">No money has moved yet.</li>}
      </ul>

      <H>PayPal references</H>
      <ul className="space-y-1">
        {items.map(({ item, batch }) => (
          <li key={item.id}>
            {batch.name} ({batch.paypalMode ?? "not sent"}) · {item.receiverName} &lt;{item.receiverEmail}&gt; · {formatMoney(item.amountCents, item.currency)} · {item.status}
            <span className="ml-1 font-mono text-xs">
              batch {batch.paypalPayoutBatchId ?? "—"} · item {item.paypalItemId ?? "—"} · txn {item.transactionId ?? "—"}
            </span>
            {item.confirmedAt && <span className="text-success"> · receipt confirmed {when(item.confirmedAt)}</span>}
            {item.notReceivedAt && <span className="text-danger"> · reported missing {when(item.notReceivedAt)}</span>}
          </li>
        ))}
        {!items.length && <li className="text-muted">Not in any batch.</li>}
      </ul>

      <H>Audit trail</H>
      <ol className="space-y-1">
        {events.map((e) => (
          <li key={e.id}>
            <span className="tnum text-muted">{when(e.createdAt)}</span> · {name(e.actorId)} {describe(e.action)}
          </li>
        ))}
      </ol>
    </article>
  );
}
