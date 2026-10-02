import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { StackIcon } from "@phosphor-icons/react/ssr";
import { ButtonLink, Empty, Money, PageHeader, StatusPill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { batches, batchItems, db } from "@/lib/db";

export const metadata = { title: "Batches" };

export default async function BatchesPage() {
  const ctx = await requirePageCtx();
  const rows = await db
    .select({ b: batches, n: sql<number>`count(${batchItems.id})::int` })
    .from(batches)
    .leftJoin(batchItems, eq(batchItems.batchId, batches.id))
    .where(eq(batches.workspaceId, ctx.workspace.id))
    .groupBy(batches.id)
    .orderBy(desc(batches.createdAt));

  return (
    <>
      <PageHeader title="Settlement batches" sub="Group ready claims, review, then one human Approve sends them to PayPal Payouts." />
      {rows.length ? (
        <div className="divide-y divide-line rounded-[12px] border border-line">
          {rows.map(({ b, n }) => (
            <Link key={b.id} href={`/app/batches/${b.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors first:rounded-t-[12px] last:rounded-b-[12px] hover:bg-sunken">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted">
                  {n} claims, created {b.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {b.paypalPayoutBatchId && <span className="ml-2 font-mono">{b.paypalPayoutBatchId}</span>}
                </p>
              </div>
              <StatusPill status={b.status} />
              <Money cents={b.totalCents} currency={b.currency} className="w-28 text-right font-medium" />
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          icon={<StackIcon className="size-5" aria-hidden />}
          title="No batches yet"
          body="Select ready claims in the inbox, then choose Create batch."
          action={<ButtonLink href="/app/claims">Go to claims</ButtonLink>}
        />
      )}
    </>
  );
}
