import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { batchItems, db, investigations } from "@/lib/db";
import { recordLedger } from "@/lib/ledger";

const Act = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), text: z.string().trim().min(2).max(500) }),
  z.object({ action: z.literal("resolve"), outcome: z.enum(["arrived", "returned_reissue", "other"]), text: z.string().trim().min(3).max(500) }),
]);

// Notes while checking, then a resolution with an outcome. "Returned" puts the money back as owed, so the next
// batch repays it; it requires a written reference because PayPal's own record said the payout succeeded.
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const input = await body(req, Act);
    const [inv] = await db.select().from(investigations).where(and(eq(investigations.id, id), eq(investigations.workspaceId, ctx.workspace.id)));
    if (!inv) fail(404, "not_found", "Investigation not found");
    if (inv!.status !== "open") fail(409, "resolved", "Already resolved");
    const note = { by: ctx.user.id, text: input.text, at: new Date().toISOString() };
    if (input.action === "note") {
      await db.update(investigations).set({ notes: [...inv!.notes, note] }).where(eq(investigations.id, id));
      return { ok: true };
    }
    const [item] = await db.select().from(batchItems).where(eq(batchItems.id, inv!.batchItemId));
    const group = item.payoutGroup ? await db.select().from(batchItems).where(and(eq(batchItems.batchId, item.batchId), eq(batchItems.payoutGroup, item.payoutGroup))) : [item];
    if (input.outcome === "arrived") await db.update(batchItems).set({ confirmedAt: new Date(), notReceivedAt: null }).where(inArray(batchItems.id, group.map((g) => g.id)));
    if (input.outcome === "returned_reissue") {
      await recordLedger(
        ctx.workspace.id,
        ctx.user.id,
        group.map((g) => ({ claimId: g.claimId, userId: g.receiverUserId!, kind: "payout_reversal" as const, amountCents: g.amountCents, currency: g.currency, reference: input.text, batchItemId: g.id })),
      );
      await db.update(batchItems).set({ notReceivedAt: null }).where(inArray(batchItems.id, group.map((g) => g.id)));
    }
    await db.update(investigations).set({ status: "resolved", outcome: input.outcome, notes: [...inv!.notes, note], resolvedBy: ctx.user.id, resolvedAt: new Date() }).where(eq(investigations.id, id));
    await audit(ctx.workspace.id, ctx.user.id, "investigation.resolved", "claim", inv!.claimId, { outcome: input.outcome, note: input.text });
    return { ok: true };
  },
  { admin: true },
);
