import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { batches, batchItems, db, investigations } from "@/lib/db";

// The receiver confirms the money arrived, or reports it missing (which opens an investigation).
export const POST = route<{ itemId: string }>(async (req, ctx, { itemId }) => {
  const { received, note } = await body(req, z.object({ received: z.boolean(), note: z.string().trim().max(500).optional() }));
  const [row] = await db
    .select({ item: batchItems })
    .from(batchItems)
    .innerJoin(batches, eq(batches.id, batchItems.batchId))
    .where(and(eq(batchItems.id, itemId), eq(batches.workspaceId, ctx.workspace.id)));
  if (!row) fail(404, "not_found", "Payout not found");
  if (row!.item.receiverUserId !== ctx.user.id) fail(403, "forbidden", "Only the receiver can confirm this payout");
  if (row!.item.status !== "SUCCESS") fail(409, "not_paid", "PayPal hasn't completed this payout yet");
  // Confirming a whole netted payout: every item in the same PayPal group.
  const group = row!.item.payoutGroup;
  const where = group ? and(eq(batchItems.batchId, row!.item.batchId), eq(batchItems.payoutGroup, group)) : eq(batchItems.id, itemId);
  await db.update(batchItems).set(received ? { confirmedAt: new Date(), notReceivedAt: null } : { notReceivedAt: new Date(), confirmedAt: null }).where(where);
  await audit(ctx.workspace.id, ctx.user.id, received ? "payout.confirmed_received" : "payout.reported_missing", "batch_item", itemId, { note });
  // Missing money opens one tracked investigation (not a second one for the same payout).
  if (!received) {
    const open = await db.select().from(investigations).where(and(eq(investigations.batchItemId, itemId), eq(investigations.status, "open")));
    if (!open.length)
      await db.insert(investigations).values({ workspaceId: ctx.workspace.id, claimId: row!.item.claimId, batchItemId: itemId, openedBy: ctx.user.id, reason: note || "Receiver reports the money never arrived" });
  }
  return { ok: true };
});
