import { eq } from "drizzle-orm";
import { applyItemStatuses, refreshBatch } from "@/lib/batches";
import { batches, db, webhookEvents } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal";

// PAYMENT.PAYOUTS-ITEM.* and PAYMENT.PAYOUTSBATCH.* events. Signature verified with PayPal before use.
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event) return Response.json({ error: { code: "invalid", message: "Bad JSON" } }, { status: 400 });
  if (!(await verifyWebhook(req.headers, event).catch(() => false)))
    return Response.json({ error: { code: "unverified", message: "Signature verification failed" } }, { status: 401 });

  // Replayed deliveries are skipped. Recorded only after processing, so a failed attempt is retried by PayPal;
  // concurrent duplicates are safe because every status write is compare-and-set.
  const eventId = event.id ? String(event.id) : null;
  if (eventId && (await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId))).length) return Response.json({ ok: true, duplicate: true });

  const r = event.resource ?? {};
  const payoutBatchId: string | undefined = r.payout_batch_id ?? r.batch_header?.payout_batch_id;
  if (!payoutBatchId) return Response.json({ ok: true, ignored: true });
  const [batch] = await db.select().from(batches).where(eq(batches.paypalPayoutBatchId, payoutBatchId));
  if (!batch) return Response.json({ ok: true, ignored: true });

  if (String(event.event_type).startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    await applyItemStatuses(batch.id, [
      {
        senderItemId: r.payout_item?.sender_item_id,
        payoutItemId: r.payout_item_id,
        status: r.transaction_status,
        transactionId: r.transaction_id,
        error: r.errors?.message,
      },
    ], null);
  } else {
    await refreshBatch(batch.workspaceId, batch.id, null);
  }
  if (eventId) await db.insert(webhookEvents).values({ id: eventId }).onConflictDoNothing();
  return Response.json({ ok: true });
}
