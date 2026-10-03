import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { revalidateApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { claimLines, claims, db } from "@/lib/db";
import { linesFor } from "@/lib/ledger";

const REASONS = ["personal", "over_policy", "missing_receipt", "duplicate_item", "other"] as const;
const Lines = z.object({
  lines: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        amountCents: z.number().int().min(0).max(100_000_000),
        excluded: z.boolean().default(false),
        excludeReason: z.enum(REASONS).nullable().optional(),
      }),
    )
    .max(100),
});

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  return linesFor(c!);
});

// Replaces the line items. Excluding a personal item removes it (and its share of tax and tip) from what is reimbursed.
export const PUT = route<{ id: string }>(async (req, ctx, { id }) => {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  if (!["draft", "pending_review", "matched"].includes(c!.status)) fail(409, "locked", `Claim is ${c!.status} and can no longer be edited`);
  if (!ctx.isAdmin && c!.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");
  const { lines } = await body(req, Lines);
  if (lines.some((l) => l.excluded && !l.excludeReason)) fail(400, "reason_required", "Say why each excluded line isn't reimbursed");
  const sum = lines.reduce((a, l) => a + l.amountCents, 0);
  if (sum > c!.amountCents) fail(400, "over_total", "Line items add up to more than the claim total");
  await db.delete(claimLines).where(eq(claimLines.claimId, id));
  if (lines.length) await db.insert(claimLines).values(lines.map((l, i) => ({ ...l, excludeReason: l.excluded ? l.excludeReason : null, claimId: id, position: i })));
  await audit(ctx.workspace.id, ctx.user.id, "claim.lines_set", "claim", id, { lines: lines.length, excluded: lines.filter((l) => l.excluded).length });
  return revalidateApproval(ctx.workspace.id, id, ctx.user.id);
});
