import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";
import { impliedRate } from "@/lib/settlement";

// Records what the card was actually charged and which amount to reimburse. The rate is stated, never hidden.
export const PUT = route<{ id: string }>(async (req, ctx, { id }) => {
  const { chargedCents, chargedCurrency, reimburse, fxSource } = await body(
    req,
    z.object({
      chargedCents: z.number().int().positive().max(100_000_000),
      chargedCurrency: z.string().length(3).toUpperCase(),
      reimburse: z.enum(["charged", "receipt"]),
      fxSource: z.string().trim().min(2).max(120),
    }),
  );
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!["draft", "pending_review", "matched"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status} and can no longer be edited`);
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");
  const receiptCents = c!.receiptCents ?? c!.amountCents;
  const receiptCurrency = c!.receiptCurrency ?? c!.currency;
  const set = {
    receiptCents,
    receiptCurrency,
    chargedCents,
    chargedCurrency,
    fxRate: impliedRate(receiptCents, chargedCents),
    fxSource,
    fxAt: new Date(),
    ...(reimburse === "charged" ? { amountCents: chargedCents, currency: chargedCurrency } : { amountCents: receiptCents, currency: receiptCurrency }),
    updatedAt: new Date(),
  };
  await db.update(claims).set(set).where(eq(claims.id, id));
  await audit(ctx.workspace.id, ctx.user.id, "claim.currency_set", "claim", id, { receipt: `${receiptCents} ${receiptCurrency}`, charged: `${chargedCents} ${chargedCurrency}`, rate: set.fxRate, source: fxSource, reimburse });
  return revalidateApproval(ctx.workspace.id, id, ctx.user.id);
});
