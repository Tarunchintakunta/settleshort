import { desc, eq, sql } from "drizzle-orm";
import { StackIcon } from "@phosphor-icons/react/ssr";
import { BatchesGrid } from "@/components/batches/batches-grid";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { batches, batchItems, db } from "@/lib/db";

export const metadata = { title: "Batches" };

export default async function BatchesPage() {
  const ctx = await requirePageCtx();
  const rows = await db
    .select({
      b: batches,
      n: sql<number>`count(${batchItems.id})::int`,
      paid: sql<number>`count(*) filter (where ${batchItems.status} = 'SUCCESS')::int`,
    })
    .from(batches)
    .leftJoin(batchItems, eq(batchItems.batchId, batches.id))
    .where(eq(batches.workspaceId, ctx.workspace.id))
    .groupBy(batches.id)
    .orderBy(desc(batches.createdAt));

  return (
    <>
      <PageHeader title="Settlement batches" sub="Group ready claims, review, then one human Approve sends them to PayPal Payouts." />
      {rows.length ? (
        <BatchesGrid
          rows={rows.map(({ b, n, paid }) => ({
            id: b.id,
            name: b.name,
            items: n,
            paid,
            status: b.status,
            totalCents: b.totalCents,
            currency: b.currency,
            paypalPayoutBatchId: b.paypalPayoutBatchId,
            mode: b.paypalMode,
            createdAt: b.createdAt.toISOString(),
            approvedAt: b.approvedAt?.toISOString() ?? null,
          }))}
        />
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
