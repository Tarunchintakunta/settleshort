import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { advancesWithSpend } from "@/lib/advances";
import { audit } from "@/lib/audit";
import { advances, db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { formatMoney } from "@/lib/money";

// Closes an advance once the leftover is returned (or the overspend is claimed as personal money).
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const { note } = await body(req, z.object({ note: z.string().trim().min(3).max(300) }));
    const a = (await advancesWithSpend(ctx.workspace.id)).find((x) => x.id === id);
    if (!a) fail(404, "not_found", "Advance not found");
    if (a!.status === "settled") fail(409, "settled", "Already settled");
    const settlement = `Advanced ${formatMoney(a!.advancedCents, a!.currency)}, spent ${formatMoney(a!.spentCents, a!.currency)}, ${a!.leftCents ? `${formatMoney(a!.leftCents, a!.currency)} returned` : a!.overspentCents ? `${formatMoney(a!.overspentCents, a!.currency)} overspent` : "exactly used"}. ${note}`;
    await db.update(advances).set({ status: "settled", settlement, settledAt: new Date() }).where(eq(advances.id, id));
    await audit(ctx.workspace.id, ctx.user.id, "advance.settled", "advance", id, { settlement });
    return { settlement };
  },
  { admin: true },
);
