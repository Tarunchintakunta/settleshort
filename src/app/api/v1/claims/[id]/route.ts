import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { runMatching } from "@/lib/claims";
import { claims, db } from "@/lib/db";

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
  payerUserId: z.string().uuid().optional(),
  markReady: z.boolean().optional(), // reviewer confirms -> matched
});

export const PATCH = route<{ id: string }>(async (req, ctx, { id }) => {
  const c = await load(ctx.workspace.id, id);
  const { markReady, ...fields } = await body(req, Patch);
  if (!["draft", "pending_review", "matched"].includes(c.status)) fail(409, "locked", `Claim is ${c.status} and can no longer be edited`);
  if ((markReady || fields.payerUserId) && !ctx.isAdmin) fail(403, "forbidden", "Admins only");
  if (!ctx.isAdmin && c.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only edit your own claims");

  const changes = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== undefined && v !== c[k as keyof typeof c]));
  const [updated] = await db
    .update(claims)
    .set({ ...changes, ...(markReady ? { status: "matched" as const, duplicateOfId: null } : {}), updatedAt: new Date() })
    .where(eq(claims.id, id))
    .returning();
  if (Object.keys(changes).length) await audit(ctx.workspace.id, ctx.user.id, "claim.edited", "claim", id, { changes });
  if (markReady) await audit(ctx.workspace.id, ctx.user.id, "claim.marked_ready", "claim", id, {});
  return markReady ? updated : Object.keys(changes).length ? runMatching(ctx.workspace.id, id) : updated;
});
