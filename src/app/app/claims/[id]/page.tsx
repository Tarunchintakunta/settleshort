import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FilePdfIcon, QuotesIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { ClaimEditor } from "@/components/claims/claim-editor";
import { Confidence, Money, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { LOW_CONFIDENCE, workspaceMembers } from "@/lib/claims";
import { batches, batchItems, claims, claimSplits, db, receipts } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Claim" };

type Ai = { provider?: string; evidence?: Record<string, string>; ocr_text?: string; line_items?: { name: string; amount_cents: number }[] } & Record<string, unknown>;
type MatchJson = { rationale?: string; candidates?: { id: string; number?: number; score: number; reasons: string[] }[] };

const SOURCE: Record<string, string> = { upload: "receipt upload", slack: "Slack", email: "email", manual: "message" };

export default async function ClaimPage({ params }: PageProps<"/app/claims/[id]">) {
  const { id } = await params;
  const ctx = await requirePageCtx();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!claim) notFound();

  const [members, splits, receipt, dupOf, batchRow] = await Promise.all([
    workspaceMembers(ctx.workspace.id),
    db.select().from(claimSplits).where(eq(claimSplits.claimId, id)),
    claim.receiptId ? db.select({ id: receipts.id, mime: receipts.mime, filename: receipts.filename }).from(receipts).where(eq(receipts.id, claim.receiptId)).then((r) => r[0]) : null,
    claim.duplicateOfId ? db.select().from(claims).where(eq(claims.id, claim.duplicateOfId)).then((r) => r[0]) : null,
    db.select({ item: batchItems, batch: batches }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(eq(batchItems.claimId, id)).then((r) => r.at(-1)),
  ]);
  const name = (uid: string) => members.find((m) => m.id === uid)?.name ?? "Unknown";
  const ai = claim.aiJson as Ai | null;
  const match = claim.matchJson as MatchJson | null;
  const evidence = Object.entries(ai?.evidence ?? {}).filter(([, v]) => v);

  return (
    <>
      <Link href="/app/claims" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeftIcon className="size-3.5" aria-hidden /> Claims
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <StatusPill status={claim.status} />
            <span className="text-[13px] text-muted">
              <span className="font-mono">#{claim.number}</span> from {name(claim.submitterId)} via {SOURCE[claim.source]}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em]">{claim.vendor || "Untitled claim"}</h1>
        </div>
        <div className="text-right">
          <Money cents={claim.amountCents} currency={claim.currency} className="text-[36px] font-semibold tracking-tight" />
          <p className="text-[13px] text-muted">Reimburses {name(claim.payerUserId)}</p>
        </div>
      </header>

      {claim.duplicateOfId && dupOf && (
        <section className="rise mb-8 rounded-[12px] border border-warning/30 bg-warning-soft p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <WarningIcon className="size-4" weight="fill" aria-hidden /> Possible duplicate
          </p>
          {match?.rationale && <p className="mt-1.5 text-sm text-ink-2">{match.rationale}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "This claim", c: claim },
              { label: `Existing #${dupOf.number}`, c: dupOf },
            ].map(({ label, c }) => (
              <div key={label} className="rounded-[10px] bg-panel p-4 text-sm">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 font-medium">{c.vendor}</p>
                <p className="mt-0.5 flex justify-between text-ink-2">
                  <span>
                    {c.txnDate ?? "No date"} · {name(c.payerUserId)}
                  </span>
                  <Money cents={c.amountCents} currency={c.currency} />
                </p>
              </div>
            ))}
          </div>
          <Link href={`/app/claims/${dupOf.id}`} className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
            Open #{dupOf.number}
          </Link>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {receipt ? (
            <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-[12px] border border-line bg-sunken p-5">
              {receipt.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/v1/receipts/${receipt.id}`} alt={`Receipt ${receipt.filename}`} className="max-h-[560px] w-auto rounded-[6px] shadow-soft" />
              ) : (
                <a href={`/api/v1/receipts/${receipt.id}`} target="_blank" className="flex flex-col items-center gap-3 text-muted hover:text-ink">
                  <FilePdfIcon className="size-14" weight="light" aria-hidden />
                  <span className="text-sm">Open {receipt.filename}</span>
                </a>
              )}
            </div>
          ) : claim.rawText ? (
            <div className="rounded-[12px] border border-line bg-sunken p-5">
              <p className="text-xs text-muted">Original message</p>
              <p className="mt-2 text-[15px] leading-relaxed">{claim.rawText}</p>
            </div>
          ) : null}

          {(evidence.length > 0 || ai) && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium">What was read</h2>
                <Confidence value={claim.aiConfidence} provider={ai?.provider} />
              </div>
              {evidence.length > 0 && (
                <ul className="space-y-1.5">
                  {evidence.map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2 text-[13px]">
                      <QuotesIcon className="mt-0.5 size-3 shrink-0 text-muted" weight="fill" aria-hidden />
                      <span className="w-14 shrink-0 capitalize text-muted">{k}</span>
                      <span className="font-mono text-ink-2">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3 text-[13px]">
                <summary className="cursor-pointer text-muted hover:text-ink">Raw extraction JSON</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-[8px] bg-sunken p-3 font-mono text-[11.5px] leading-relaxed">{JSON.stringify({ ...ai, ocr_text: undefined, match }, null, 2)}</pre>
                {ai?.ocr_text && <pre className="mt-2 max-h-48 overflow-auto rounded-[8px] bg-sunken p-3 font-mono text-[11.5px] leading-relaxed">{ai.ocr_text}</pre>}
              </details>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-sm font-medium">Details</h2>
            <ClaimEditor
              claim={claim}
              members={members}
              isAdmin={ctx.isAdmin}
              canEdit={ctx.isAdmin || claim.submitterId === ctx.user.id}
              lowConfidence={claim.aiConfidence != null && claim.aiConfidence < LOW_CONFIDENCE}
            />
          </section>

          {(ai?.line_items?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium">Line items</h2>
              <ul className="divide-y divide-line border-y border-line text-sm">
                {ai!.line_items!.map((l, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span className="text-ink-2">{l.name}</span>
                    <Money cents={l.amount_cents} currency={claim.currency} />
                  </li>
                ))}
                {claim.taxCents > 0 && (
                  <li className="flex justify-between py-2 text-muted">
                    <span>Tax</span>
                    <span className="tnum">{formatMoney(claim.taxCents, claim.currency)}</span>
                  </li>
                )}
                {claim.tipCents > 0 && (
                  <li className="flex justify-between py-2 text-muted">
                    <span>Tip</span>
                    <span className="tnum">{formatMoney(claim.tipCents, claim.currency)}</span>
                  </li>
                )}
              </ul>
            </section>
          )}

          {splits.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium">Shared with</h2>
              <ul className="flex flex-wrap gap-2">
                {splits.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-[13px]">
                    <span className="flex size-6 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold" aria-hidden>
                      {name(s.userId)[0]}
                    </span>
                    {name(s.userId)} <Money cents={s.amountCents} currency={claim.currency} className="text-muted" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {batchRow && (
            <section>
              <h2 className="mb-2 text-sm font-medium">Settlement</h2>
              <Link href={`/app/batches/${batchRow.batch.id}`} className="flex items-center justify-between rounded-[10px] border border-line px-4 py-3 text-sm hover:bg-sunken">
                <span>
                  <span className="font-medium">{batchRow.batch.name}</span>
                  {batchRow.item.transactionId && <span className="ml-2 font-mono text-xs text-muted">{batchRow.item.transactionId}</span>}
                </span>
                <StatusPill status={batchRow.item.status} />
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
