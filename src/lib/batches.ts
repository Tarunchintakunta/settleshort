import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { fail } from "./api";
import { audit } from "./audit";
import { batches, batchItems, claims, db, memberships, users, workspaces } from "./db";
import { formatMoney } from "./money";
import { createPayout, getPayout, paypalMode, PayoutItemStatus } from "./paypal";

export async function createBatch(workspaceId: string, actorId: string, claimIds: string[], name?: string) {
  const rows = await db
    .select({ claim: claims, payerName: users.name, paypalEmail: memberships.paypalReceiverEmail })
    .from(claims)
    .innerJoin(users, eq(users.id, claims.payerUserId))
    .leftJoin(memberships, and(eq(memberships.userId, claims.payerUserId), eq(memberships.workspaceId, workspaceId)))
    .where(and(eq(claims.workspaceId, workspaceId), inArray(claims.id, claimIds)));

  if (rows.length !== claimIds.length) fail(404, "not_found", "Some claims were not found");
  const notReady = rows.filter((r) => r.claim.status !== "matched");
  if (notReady.length) fail(409, "not_ready", `Only matched claims can be batched (#${notReady.map((r) => r.claim.number).join(", #")})`);
  const currencies = new Set(rows.map((r) => r.claim.currency));
  if (currencies.size > 1) fail(400, "mixed_currency", "A batch must use a single currency");
  const noEmail = rows.filter((r) => !r.paypalEmail);
  if (noEmail.length) fail(400, "missing_paypal_email", `Set a PayPal email for: ${[...new Set(noEmail.map((r) => r.payerName))].join(", ")}`);

  const total = rows.reduce((s, r) => s + r.claim.amountCents, 0);
  const currency = [...currencies][0];
  const [batch] = await db
    .insert(batches)
    .values({
      workspaceId,
      createdBy: actorId,
      name: name?.trim() || `Settlement ${new Date().toISOString().slice(0, 10)}`,
      totalCents: total,
      currency,
      status: "awaiting_approval",
    })
    .returning();
  await db.insert(batchItems).values(
    rows.map((r) => ({
      batchId: batch.id,
      claimId: r.claim.id,
      receiverEmail: r.paypalEmail!,
      receiverName: r.payerName,
      amountCents: r.claim.amountCents,
      currency,
    })),
  );
  await db.update(claims).set({ status: "in_batch", updatedAt: new Date() }).where(inArray(claims.id, claimIds));
  await audit(workspaceId, actorId, "batch.created", "batch", batch.id, { claims: rows.length, total: formatMoney(total, currency) });
  return batch;
}

/** The human gate. Only path in the codebase that moves money. */
export async function approveBatch(workspaceId: string, actorId: string, batchId: string) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.workspaceId, workspaceId)));
  if (!batch) fail(404, "not_found", "Batch not found");
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));

  const overSingle = items.filter((i) => i.amountCents > ws.maxSingleCents);
  if (overSingle.length) fail(400, "cap_single", `Item over single-payout cap of ${formatMoney(ws.maxSingleCents, batch.currency)}`);
  if (batch.totalCents > ws.maxBatchCents) fail(400, "cap_batch", `Batch exceeds cap of ${formatMoney(ws.maxBatchCents, batch.currency)}`);

  // Atomic state flip = idempotency guard: a double-click or replay finds status != awaiting_approval.
  const [locked] = await db
    .update(batches)
    .set({ status: "submitting", approvedAt: new Date(), approvedBy: actorId })
    .where(and(eq(batches.id, batchId), eq(batches.status, "awaiting_approval")))
    .returning();
  if (!locked) fail(409, "already_processed", `Batch is ${batch.status}, not awaiting approval`);

  await audit(workspaceId, actorId, "batch.approved", "batch", batchId, { total: formatMoney(batch.totalCents, batch.currency), items: items.length });

  try {
    const { payoutBatchId, raw } = await createPayout(
      batch.id,
      items.map((i) => ({ senderItemId: i.claimId, email: i.receiverEmail, amountCents: i.amountCents, currency: i.currency, note: `SettleShort claim ${i.claimId.slice(0, 8)}` })),
    );
    await db.update(batches).set({ status: "submitted", paypalPayoutBatchId: payoutBatchId, paypalMode: paypalMode(), paypalResponse: raw }).where(eq(batches.id, batchId));
    await db.update(batchItems).set({ status: "PENDING" }).where(eq(batchItems.batchId, batchId));
    await audit(workspaceId, actorId, "payout.created", "batch", batchId, { paypal_payout_batch_id: payoutBatchId, mode: paypalMode() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(batches).set({ status: "failed", errorMessage: message, paypalMode: paypalMode() }).where(eq(batches.id, batchId));
    // Release claims so they can go into a fresh batch (new sender_batch_id).
    await db.update(claims).set({ status: "matched", updatedAt: new Date() }).where(inArray(claims.id, items.map((i) => i.claimId)));
    await audit(workspaceId, actorId, "payout.failed", "batch", batchId, { error: message });
    fail(502, "paypal_error", message);
  }
  return refreshBatch(workspaceId, batchId, actorId);
}

const PAID = new Set(["SUCCESS"]);
const FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);
const TERMINAL = new Set([...PAID, ...FAILED, "UNCLAIMED"]);

export async function refreshBatch(workspaceId: string, batchId: string, actorId: string | null) {
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.workspaceId, workspaceId)));
  if (!batch) fail(404, "not_found", "Batch not found");
  if (!batch.paypalPayoutBatchId) return batch;
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));
  const status = await getPayout(batch.paypalPayoutBatchId, items.map((i) => ({ senderItemId: i.claimId, email: i.receiverEmail })));
  return applyItemStatuses(batch.id, status.items, actorId, status.raw);
}

/** Shared by polling and webhooks. */
export async function applyItemStatuses(batchId: string, statuses: PayoutItemStatus[], actorId: string | null, raw?: unknown) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));
  for (const s of statuses) {
    const item = items.find((i) => i.claimId === s.senderItemId || (s.payoutItemId && i.paypalItemId === s.payoutItemId));
    if (!item || item.status === s.status) continue;
    await db
      .update(batchItems)
      .set({ status: s.status, paypalItemId: s.payoutItemId, transactionId: s.transactionId ?? null, errorMessage: s.error ?? null })
      .where(eq(batchItems.id, item.id));
    item.status = s.status;
    const claimStatus = PAID.has(s.status) ? "paid" : FAILED.has(s.status) ? "failed" : null;
    if (claimStatus) await db.update(claims).set({ status: claimStatus, updatedAt: new Date() }).where(eq(claims.id, item.claimId));
    await audit(batch.workspaceId, actorId, `payout.item.${s.status.toLowerCase()}`, "batch_item", item.id, {
      receiver: item.receiverEmail,
      amount: formatMoney(item.amountCents, item.currency),
      transaction_id: s.transactionId,
      error: s.error,
    });
  }
  let next = batch.status;
  if (items.every((i) => TERMINAL.has(i.status))) {
    next = items.every((i) => PAID.has(i.status)) ? "completed" : items.some((i) => PAID.has(i.status)) ? "partial" : "failed";
  }
  const [updated] = await db
    .update(batches)
    .set({ status: next, ...(raw ? { paypalResponse: raw } : {}) })
    .where(eq(batches.id, batchId))
    .returning();
  if (next !== batch.status) await audit(batch.workspaceId, actorId, `batch.${next}`, "batch", batchId, {});
  return updated;
}
