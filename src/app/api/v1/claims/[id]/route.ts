import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { approveClaim, revalidateApproval } from "@/lib/approvals";
import { runMatching } from "@/lib/claims";
import { aiFeedback, CATEGORIES, claims, db, merchantMappings } from "@/lib/db";
import { normalizeMerchant } from "@/lib/matching";

const AI_FIELDS: Record<string, string> = { vendor: "vendor", amountCents: "amount_cents", txnDate: "txn_date", currency: "currency" };

/** A person overruling the extractor or a merchant rule is recorded as feedback. It never changes policy by itself. */
async function recordOverrides(workspaceId: string, actorId: string, c: typeof claims.$inferSelect, changes: Record<string, unknown>, reason?: string) {
  const ai = c.aiJson as Record<string, unknown> | null;
  const rows: (typeof aiFeedback.$inferInsert)[] = [];
  for (const [k, aiKey] of Object.entries(AI_FIELDS))
    if (k in changes && ai && ai[aiKey] != null && String(ai[aiKey]) !== String(changes[k]))
      rows.push({ workspaceId, claimId: c.id, kind: "extraction", subject: k, suggested: String(ai[aiKey]), corrected: String(changes[k]), reason, actorId });
  if ("category" in changes && c.categorySource === "mapping")
    rows.push({ workspaceId, claimId: c.id, kind: "category", subject: c.vendor, suggested: c.category, corrected: String(changes.category ?? ""), reason, actorId });
  if (rows.length) await db.insert(aiFeedback).values(rows);
}

async function load(workspaceId: string, id: string) {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, workspaceId)));
  if (!c) fail(404, "not_found", "Claim not found");
  return c;
}

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => load(ctx.workspace.id, id));

const Patch = z.object({
  vendor: z.string().trim().max(200).optional(),
  amountCents: z.number().int().positive().max(100_000_000).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(1000).optional(),
  purpose: z.string().trim().max(500).optional(),
  payerUserId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  // "always" turns this claim's category into the merchant rule (admins only). Default: this claim only.
  categoryRule: z.enum(["once", "always"]).optional(),
  // Why a person overrules the AI or a rule; kept with the feedback record.
  reason: z.string().trim().max(300).optional(),
  markReady: z.boolean().optional(), // human approval -> matched (see approveClaim)
});

export const PATCH = route<{ id: string }>(async (req, ctx, { id }) => {
  const c = await load(ctx.workspace.id, id);
  const { markReady, categoryRule, reason, ...fields } = await body(req, Patch);
  const approveOnly = markReady && Object.values(fields).every((v) => v === undefined);
  if (approveOnly) return approveClaim(ctx.workspace, { id: ctx.user.id, role: ctx.role! }, id);
  if (!["draft", "pending_review", "matched"].includes(c.status)) fail(409, "locked", `Claim is ${c.status} and can no longer be edited`);
  if (fields.payerUserId && !ctx.isAdmin) fail(403, "forbidden", "Admins only");
  if (categoryRule === "always" && !ctx.isAdmin) fail(403, "forbidden", "Only admins change merchant rules");
  if (!markReady && !ctx.isAdmin && c.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");

  const changes: Record<string, unknown> = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== undefined && v !== c[k as keyof typeof c]));
  if ("category" in changes) changes.categorySource = "human";
  if (Object.keys(changes).length) {
    await db.update(claims).set({ ...changes, updatedAt: new Date() }).where(eq(claims.id, id));
    await recordOverrides(ctx.workspace.id, ctx.user.id, c, changes, reason);
    await audit(ctx.workspace.id, ctx.user.id, "claim.edited", "claim", id, { changes });
    await revalidateApproval(ctx.workspace.id, id, ctx.user.id);
  }
  if (fields.category && categoryRule === "always" && c.vendor.trim()) {
    const merchantKey = normalizeMerchant(c.vendor);
    await db
      .insert(merchantMappings)
      .values({ workspaceId: ctx.workspace.id, merchantKey, merchantLabel: c.vendor.trim(), category: fields.category, confirmedBy: ctx.user.id })
      .onConflictDoUpdate({ target: [merchantMappings.workspaceId, merchantMappings.merchantKey], set: { category: fields.category, confirmedBy: ctx.user.id, updatedAt: new Date() } });
    await audit(ctx.workspace.id, ctx.user.id, "merchant_rule.saved", "merchant_mapping", merchantKey, { merchant: c.vendor, category: fields.category });
  }
  if (markReady) return approveClaim(ctx.workspace, { id: ctx.user.id, role: ctx.role! }, id);
  return Object.keys(changes).length ? runMatching(ctx.workspace.id, id) : c;
});
