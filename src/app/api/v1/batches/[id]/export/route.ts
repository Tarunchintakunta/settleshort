import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { batches, batchItems, claims, db } from "@/lib/db";
import { centsToDecimal } from "@/lib/money";

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, id), eq(batches.workspaceId, ctx.workspace.id)));
  if (!batch) fail(404, "not_found", "Batch not found");
  const rows = await db
    .select({ item: batchItems, claim: claims })
    .from(batchItems)
    .innerJoin(claims, eq(claims.id, batchItems.claimId))
    .where(eq(batchItems.batchId, id));
  const lines = [
    ["claim", "vendor", "date", "receiver_name", "receiver_email", "amount", "currency", "status", "paypal_item_id", "transaction_id", "error"],
    ...rows.map(({ item, claim }) => [
      `#${claim.number}`, claim.vendor, claim.txnDate, item.receiverName, item.receiverEmail, centsToDecimal(item.amountCents),
      item.currency, item.status, item.paypalItemId, item.transactionId, item.errorMessage,
    ]),
  ];
  return new Response(lines.map((l) => l.map(csv).join(",")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="settleshort-${batch.name.replace(/[^\w-]+/g, "-")}.csv"`,
    },
  });
});
