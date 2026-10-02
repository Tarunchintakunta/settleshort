import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, PlusIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink, Confidence, Money, PageHeader, Pill } from "@/components/ui";
import { describe, recentActivity, timeAgo } from "@/lib/activity";
import { requirePageCtx } from "@/lib/auth";
import { batches, batchItems, claims, db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Overview" };

export default async function Dashboard() {
  const { workspace: ws, user, isAdmin } = await requirePageCtx();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const sum = sql<number>`coalesce(sum(${claims.amountCents}), 0)::int`;
  const [[open], [paidMonth], [ai], review, awaiting, activity] = await Promise.all([
    db.select({ cents: sum, n: sql<number>`count(*)::int` }).from(claims).where(and(eq(claims.workspaceId, ws.id), inArray(claims.status, ["pending_review", "matched"]))),
    db.select({ cents: sum, n: sql<number>`count(*)::int` }).from(claims).where(and(eq(claims.workspaceId, ws.id), eq(claims.status, "paid"), gte(claims.updatedAt, monthStart))),
    db.select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(${claims.aiConfidence}),0)` }).from(claims).where(and(eq(claims.workspaceId, ws.id), isNotNull(claims.aiConfidence))),
    db.select().from(claims).where(and(eq(claims.workspaceId, ws.id), eq(claims.status, "pending_review"))).orderBy(desc(claims.createdAt)).limit(5),
    db
      .select({ b: batches, people: sql<number>`count(distinct ${batchItems.receiverEmail})::int` })
      .from(batches)
      .leftJoin(batchItems, eq(batchItems.batchId, batches.id))
      .where(and(eq(batches.workspaceId, ws.id), eq(batches.status, "awaiting_approval")))
      .groupBy(batches.id)
      .orderBy(desc(batches.createdAt))
      .limit(3),
    recentActivity(ws.id, 7),
  ]);

  // ponytail: metrics sum all currencies as USD; group by currency once INR workspaces are real.
  const metrics = [
    { label: "Open claims", value: formatMoney(open.cents, "USD"), sub: `${open.n} claims` },
    { label: "Paid this month", value: formatMoney(paidMonth.cents, "USD"), sub: `${paidMonth.n} reimbursements` },
    { label: "Extracted by AI", value: String(ai.n), sub: `${Math.round(ai.avg * 100)}% average confidence` },
  ];
  const first = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hi ${first}`}
        sub={awaiting.length ? "One decision is waiting on you. Everything else is in order." : "Nothing is waiting on your approval."}
        actions={
          <ButtonLink href="/app/claims/new">
            <PlusIcon className="size-4" weight="bold" aria-hidden /> New claim
          </ButtonLink>
        }
      />

      {awaiting.map(({ b, people }, i) => (
        <Link
          key={b.id}
          href={`/app/batches/${b.id}`}
          className="rise group relative mb-4 grid gap-6 overflow-hidden rounded-[12px] border border-line bg-panel p-6 shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-pop md:grid-cols-[1fr_auto] md:items-center md:p-8"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="absolute inset-y-0 left-0 w-[3px] bg-warning" aria-hidden />
          <div className="min-w-0 pl-2">
            <p className="flex items-center gap-2 text-[13px] font-medium text-warning">
              <ShieldCheckIcon className="size-4" weight="fill" aria-hidden /> Awaiting your approval
            </p>
            <p className="mt-2 text-[22px] font-semibold tracking-[-0.025em]">{b.name}</p>
            <p className="mt-1 text-sm text-muted">
              Pays {people} {people === 1 ? "person" : "people"} through PayPal Payouts once {isAdmin ? "you approve" : "an admin approves"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 pl-2 md:justify-end md:pl-0">
            <Money cents={b.totalCents} currency={b.currency} className="text-[40px] leading-none font-semibold sm:text-[48px]" />
            <span className="flex h-10 items-center gap-2 rounded-[8px] bg-ink px-4 text-sm font-medium text-panel transition-transform duration-200 group-hover:translate-x-0.5">
              Review <ArrowRightIcon className="size-4" aria-hidden />
            </span>
          </div>
        </Link>
      ))}

      <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[12px] border border-line bg-panel px-5 py-5 shadow-soft">
            <dt className="text-[13px] text-muted">{m.label}</dt>
            <dd className="tnum mt-2 font-mono text-[28px] leading-none font-semibold tracking-[-0.03em]">{m.value}</dd>
            <dd className="mt-2 text-xs text-muted">{m.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">Needs review</h2>
            <Link href="/app/claims" className="text-[13px] text-muted hover:text-ink">
              All claims
            </Link>
          </div>
          {review.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line">
              {review.map((c) => {
                const duplicate = !!c.duplicateOfId;
                const low = (c.aiConfidence ?? 1) < 0.55;
                const reason = duplicate ? "Possible duplicate" : low ? "Low extraction confidence" : "Waiting for a reviewer";
                return (
                  <li key={c.id}>
                    <Link href={`/app/claims/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-sunken">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="font-mono text-muted">#{c.number}</span> {c.vendor || "Untitled"}
                        </p>
                        <Pill tone={duplicate || low ? "warning" : "neutral"} dot className="mt-1.5">
                          {reason}
                        </Pill>
                      </div>
                      <span className="hidden sm:contents">
                        <Confidence value={c.aiConfidence} />
                      </span>
                      <Money cents={c.amountCents} currency={c.currency} className="shrink-0 text-right text-sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-[12px] border border-line bg-panel px-4 py-6 text-sm text-muted">
              <CheckCircleIcon className="size-5 text-success" weight="fill" aria-hidden /> Every claim has been reviewed.
            </p>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">Activity</h2>
            <Link href="/app/activity" className="text-[13px] text-muted hover:text-ink">
              Audit log
            </Link>
          </div>
          <ol className="relative space-y-5 border-l border-line pl-5">
            {activity.map(({ e, actor }) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-accent ring-2 ring-panel" aria-hidden />
                <p>
                  <span className="font-medium">{actor ?? "System"}</span> <span className="text-ink-2">{describe(e.action)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">{timeAgo(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
