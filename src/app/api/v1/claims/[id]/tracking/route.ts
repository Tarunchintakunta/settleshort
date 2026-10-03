import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";
import { obligationsFor, recordLedger } from "@/lib/ledger";

const Input = z.object({
  kind: z.enum(["expense", "deposit"]).optional(),
  depositStatus: z.enum(["held", "returned", "consumed"]).optional(),
  // Where a returned deposit went: back to the employee's card (they then owe it back) or straight to the company.
  returnedTo: z.enum(["employee", "company"]).optional(),
  depositNote: z.string().trim().max(300).optional(),
  recoverableClient: z.string().trim().max(120).nullable().optional(),
  recoveryStatus: z.enum(["to_invoice", "invoiced", "recovered", "written_off"]).nullable().optional(),
  recoveryRef: z.string().trim().max(120).optional(),
});

// Deposit and client-recovery tracking. Separate from approval: none of this changes what the employee is owed,
// except a deposit refunded to the employee's own card, which is recorded as money they owe back.
export const PATCH = route<{ id: string }>(async (req, ctx, { id }) => {
  const input = await body(req, Input);
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");
  if ((input.depositStatus && input.depositStatus !== "held") || input.recoveryStatus === "recovered" || input.recoveryStatus === "written_off")
    if (!ctx.isAdmin) fail(403, "forbidden", "Admins close deposits and recoveries");
  const kind = input.kind ?? c!.kind;
  const set: Partial<typeof claims.$inferInsert> = { updatedAt: new Date() };
  if (input.kind) set.kind = input.kind;
  if (kind === "deposit" && !c!.depositStatus) set.depositStatus = "held";
  if (input.depositStatus) {
    if (kind !== "deposit") fail(400, "not_deposit", "Mark it as a deposit first");
    set.depositStatus = input.depositStatus;
    set.depositNote = input.depositNote ?? null;
  }
  if (input.recoverableClient !== undefined) {
    set.recoverableClient = input.recoverableClient;
    set.recoveryStatus = input.recoverableClient ? (c!.recoveryStatus ?? "to_invoice") : null;
  }
  if (input.recoveryStatus !== undefined) set.recoveryStatus = input.recoveryStatus;
  if (input.recoveryRef !== undefined) set.recoveryRef = input.recoveryRef;
  await db.update(claims).set(set).where(eq(claims.id, id));

  if (input.depositStatus === "returned" && input.returnedTo === "employee") {
    const o = await obligationsFor(c!);
    await recordLedger(
      ctx.workspace.id,
      ctx.user.id,
      o.payees.filter((p) => p.owedCents > 0).map((p) => ({ claimId: id, userId: p.userId, kind: "refund" as const, amountCents: p.owedCents, currency: c!.currency, reference: input.depositNote ?? "Deposit returned" })),
    );
  }
  await audit(ctx.workspace.id, ctx.user.id, "claim.tracking_updated", "claim", id, { ...input });
  return (await db.select().from(claims).where(eq(claims.id, id)))[0];
});
