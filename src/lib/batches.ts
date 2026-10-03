import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { fail } from "./api";
import { releaseProblems } from "./approvals";
import { audit } from "./audit";
import { batches, batchItems, claims, db, memberships, users, workspaces } from "./db";
import { obligationsFor, obligationsForMany, recordLedger } from "./ledger";
import { formatMoney } from "./money";
import { isForwardTransition, PAID, FAILED, TERMINAL } from "./payout-status";
import { createPayout, getPayout, PayPalError, paypalMode, PayoutItemStatus } from "./paypal";

/** Claim statuses that can go into a batch: approved, or approved with money still outstanding. */
const BATCHABLE = ["matched", "partially_paid", "failed"] as const;

export async function createBatch(workspaceId: string, actorId: string, claimIds: string[], name?: string) {
  const rows = await db.select().from(claims).where(and(eq(claims.workspaceId, workspaceId), inArray(claims.id, claimIds)));
  if (rows.length !== claimIds.length || new Set(claimIds).size !== claimIds.length) fail(404, "not_found", "Some claims were not found");
  const notReady = rows.filter((r) => !(BATCHABLE as readonly string[]).includes(r.status));
  if (notReady.length) fail(409, "not_ready", `Only approved claims can be batched (#${notReady.map((r) => r.number).join(", #")})`);
  const problems = await releaseProblems(workspaceId, claimIds);
  if (problems.length) fail(409, "approval_stale", problems.map((p) => `#${p.number}: ${p.problems.join("; ")}`).join(" · "));
  const currencies = new Set(rows.map((r) => r.currency));
  if (currencies.size > 1) fail(400, "mixed_currency", "A batch must use a single currency");
  const currency = [...currencies][0];

  // One line per claim and person still owed money (multiple payers, partial repayments, company-funded parts).
  const owed = await obligationsForMany(rows);
  const lines = rows.flatMap((c) => owed.get(c.id)!.payees.filter((p) => p.outstandingCents > 0).map((p) => ({ claim: c, userId: p.userId, amountCents: p.outstandingCents })));
  if (!lines.length) fail(400, "nothing_owed", "Nothing is owed on these claims");
  const people = await db
    .select({ id: users.id, name: users.name, paypalEmail: memberships.paypalReceiverEmail })
    .from(users)
    .leftJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.workspaceId, workspaceId)))
    .where(inArray(users.id, [...new Set(lines.map((l) => l.userId))]));
  const person = (id: string) => people.find((p) => p.id === id)!;
  const noEmail = [...new Set(lines.filter((l) => !person(l.userId).paypalEmail).map((l) => person(l.userId).name))];
  if (noEmail.length) fail(400, "missing_paypal_email", `Set a PayPal email for: ${noEmail.join(", ")}`);

  // Claim the claims first, atomically: a double-click or concurrent request finds them already in_batch.
  const locked = await db
    .update(claims)
    .set({ status: "in_batch", updatedAt: new Date() })
    .where(and(inArray(claims.id, claimIds), inArray(claims.status, [...BATCHABLE])))
    .returning({ id: claims.id });
  if (locked.length !== claimIds.length) {
    for (const l of locked) await db.update(claims).set({ status: rows.find((r) => r.id === l.id)!.status }).where(eq(claims.id, l.id));
    fail(409, "already_batched", "These claims were just put into another batch");
  }

  const total = lines.reduce((s, l) => s + l.amountCents, 0);
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
  const items = await db
    .insert(batchItems)
    .values(
      lines.map((l) => ({
        batchId: batch.id,
        claimId: l.claim.id,
        receiverUserId: l.userId,
        receiverEmail: person(l.userId).paypalEmail!,
        receiverName: person(l.userId).name,
        amountCents: l.amountCents,
        currency,
      })),
    )
    .returning();
  // Netting: everything owed to one receiver goes out as a single PayPal item.
  const groups = new Map<string, string>();
  for (const i of items) if (!groups.has(i.receiverEmail)) groups.set(i.receiverEmail, i.id);
  for (const [email, group] of groups) await db.update(batchItems).set({ payoutGroup: group }).where(and(eq(batchItems.batchId, batch.id), eq(batchItems.receiverEmail, email)));
  await audit(workspaceId, actorId, "batch.created", "batch", batch.id, { claims: rows.length, payouts: groups.size, total: formatMoney(total, currency) });
  return batch;
}

/** PayPal items after netting: one per payout group. */
export function payoutGroups(items: (typeof batchItems.$inferSelect)[]) {
  const by = new Map<string, (typeof batchItems.$inferSelect)[]>();
  for (const i of items) {
    const g = i.payoutGroup ?? i.claimId;
    by.set(g, [...(by.get(g) ?? []), i]);
  }
  return [...by].map(([group, members]) => ({ group, members, email: members[0].receiverEmail, amountCents: members.reduce((a, m) => a + m.amountCents, 0), currency: members[0].currency }));
}

/** The human gate. Only path in the codebase that moves money. */
export async function approveBatch(workspaceId: string, actorId: string, batchId: string) {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.workspaceId, workspaceId)));
  if (!batch) fail(404, "not_found", "Batch not found");
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));

  const [me] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, actorId)));
  if (!me?.canRelease) fail(403, "no_release_authority", "You can approve claims but not release money. Ask someone with release authority (Members page).");

  // Final change check: anything that changed since each claim was approved blocks the release.
  const problems = await releaseProblems(workspaceId, items.map((i) => i.claimId));
  if (problems.length) fail(409, "changed_since_approval", `Re-approve before paying: ${problems.map((p) => `#${p.number} ${p.problems.join("; ")}`).join(" · ")}`);

  const overSingle = payoutGroups(items).filter((g) => g.amountCents > ws.maxSingleCents);
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

  return sendPayout(workspaceId, actorId, batch.id, items, false);
}

type Batch = typeof batches.$inferSelect;

const payoutItems = (items: (typeof batchItems.$inferSelect)[]) =>
  payoutGroups(items).map((g) => ({
    senderItemId: g.group,
    email: g.email,
    amountCents: g.amountCents,
    currency: g.currency,
    note: `SettleShort: ${g.members.length} claim${g.members.length === 1 ? "" : "s"}`,
  }));

/**
 * Sends (or, with replay, verifies) the payout. Three outcomes:
 * accepted -> submitted; definitive rejection -> failed + claims released; no answer -> unknown, claims stay locked.
 */
async function sendPayout(workspaceId: string, actorId: string | null, batchId: string, items: (typeof batchItems.$inferSelect)[], replay: boolean): Promise<Batch> {
  try {
    const { payoutBatchId, raw } = await createPayout(batchId, payoutItems(items), replay);
    await db.update(batches).set({ status: "submitted", errorMessage: null, paypalPayoutBatchId: payoutBatchId, paypalMode: paypalMode(), paypalResponse: raw }).where(eq(batches.id, batchId));
    await db.update(batchItems).set({ status: "PENDING" }).where(eq(batchItems.batchId, batchId));
    await audit(workspaceId, actorId, replay ? "payout.verified" : "payout.created", "batch", batchId, { paypal_payout_batch_id: payoutBatchId, mode: paypalMode() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof PayPalError && e.uncertain) {
      const [b] = await db.update(batches).set({ status: "unknown", errorMessage: message, paypalMode: paypalMode() }).where(eq(batches.id, batchId)).returning();
      await audit(workspaceId, actorId, "payout.uncertain", "batch", batchId, { error: message });
      return b;
    }
    await db.update(batches).set({ status: "failed", errorMessage: message, paypalMode: paypalMode() }).where(eq(batches.id, batchId));
    // Definitive rejection: nothing was paid, so release claims for a fresh batch (new sender_batch_id).
    for (const id of new Set(items.map((i) => i.claimId))) {
      const [c] = await db.select().from(claims).where(eq(claims.id, id));
      const settled = (await obligationsFor(c)).payees.some((p) => p.settledCents > 0);
      await db.update(claims).set({ status: settled ? "partially_paid" : "matched", updatedAt: new Date() }).where(eq(claims.id, id));
    }
    await audit(workspaceId, actorId, "payout.failed", "batch", batchId, { error: message });
    fail(502, "paypal_error", message);
  }
  return refreshBatch(workspaceId, batchId, actorId);
}


export async function refreshBatch(workspaceId: string, batchId: string, actorId: string | null): Promise<Batch> {
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.workspaceId, workspaceId)));
  if (!batch) fail(404, "not_found", "Batch not found");
  if (batch.status === "unknown") {
    // Verify before anything else: replaying the same request id can never pay twice.
    const unsure = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));
    return sendPayout(workspaceId, actorId, batchId, unsure, true);
  }
  if (!batch.paypalPayoutBatchId) return batch;
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));
  const status = await getPayout(batch.paypalPayoutBatchId, payoutGroups(items).map((g) => ({ senderItemId: g.group, email: g.email })));
  return applyItemStatuses(batch.id, status.items, actorId, status.raw);
}

/** Shared by polling and webhooks. Every write is compare-and-set, so concurrent updates apply once. */
export async function applyItemStatuses(batchId: string, statuses: PayoutItemStatus[], actorId: string | null, raw?: unknown) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batchId));
  for (const s of statuses) {
    // A netted PayPal item covers every batch item in its payout group.
    const group = items.filter((i) => (i.payoutGroup ?? i.claimId) === s.senderItemId || (s.payoutItemId && i.paypalItemId === s.payoutItemId));
    for (const item of group) {
      if (!isForwardTransition(item.status, s.status)) continue;
      const [won] = await db
        .update(batchItems)
        .set({ status: s.status, paypalItemId: s.payoutItemId, transactionId: s.transactionId ?? null, errorMessage: s.error ?? null })
        .where(and(eq(batchItems.id, item.id), eq(batchItems.status, item.status)))
        .returning({ id: batchItems.id });
      if (!won) continue;
      const wasPaid = PAID.has(item.status);
      item.status = s.status;
      const kind = PAID.has(s.status) ? "payout" : wasPaid && FAILED.has(s.status) ? "payout_reversal" : null;
      const userId = item.receiverUserId ?? (await db.select({ u: claims.payerUserId }).from(claims).where(eq(claims.id, item.claimId)))[0].u;
      if (kind) await recordLedger(batch.workspaceId, actorId, [{ claimId: item.claimId, userId, kind, amountCents: item.amountCents, currency: item.currency, reference: s.transactionId ?? s.payoutItemId, batchItemId: item.id }]);
      else if (FAILED.has(s.status)) await db.update(claims).set({ status: "failed", updatedAt: new Date() }).where(eq(claims.id, item.claimId));
      await audit(batch.workspaceId, actorId, `payout.item.${s.status.toLowerCase()}`, "batch_item", item.id, {
        receiver: item.receiverEmail,
        amount: formatMoney(item.amountCents, item.currency),
        transaction_id: s.transactionId,
        error: s.error,
      });
    }
  }
  let next = batch.status;
  if (items.every((i) => TERMINAL.has(i.status))) {
    next = items.every((i) => PAID.has(i.status)) ? "completed" : items.some((i) => PAID.has(i.status)) ? "partial" : "failed";
  }
  const [moved] = await db
    .update(batches)
    .set({ status: next, ...(raw ? { paypalResponse: raw } : {}) })
    .where(and(eq(batches.id, batchId), eq(batches.status, batch.status)))
    .returning();
  if (moved && next !== batch.status) await audit(batch.workspaceId, actorId, `batch.${next}`, "batch", batchId, {});
  return moved ?? (await db.select().from(batches).where(eq(batches.id, batchId)))[0];
}
