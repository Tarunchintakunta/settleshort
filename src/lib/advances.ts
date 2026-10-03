import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { advances, claimPayments, claims, db } from "./db";
import { reconcileAdvance } from "./settlement";

/** Every advance with what it paid for so far (rejected claims don't count). */
export async function advancesWithSpend(workspaceId: string, userId?: string) {
  const rows = await db
    .select()
    .from(advances)
    .where(and(eq(advances.workspaceId, workspaceId), userId ? eq(advances.userId, userId) : undefined))
    .orderBy(desc(advances.createdAt));
  const ids = rows.map((r) => r.id);
  const used = ids.length
    ? await db
        .select({ advanceId: claimPayments.advanceId, amountCents: claimPayments.amountCents, claimId: claims.id, number: claims.number, vendor: claims.vendor })
        .from(claimPayments)
        .innerJoin(claims, eq(claims.id, claimPayments.claimId))
        .where(and(inArray(claimPayments.advanceId, ids), ne(claims.status, "rejected")))
    : [];
  return rows.map((a) => {
    const spent = used.filter((u) => u.advanceId === a.id);
    return { ...a, claims: spent, ...reconcileAdvance(a.amountCents, spent.reduce((s, u) => s + u.amountCents, 0)) };
  });
}
