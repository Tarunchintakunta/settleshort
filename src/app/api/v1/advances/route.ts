import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { advancesWithSpend } from "@/lib/advances";
import { audit } from "@/lib/audit";
import { advances, db, memberships } from "@/lib/db";

export const GET = route(async (_req, ctx) => advancesWithSpend(ctx.workspace.id, ctx.isAdmin ? undefined : ctx.user.id));

// Records money advanced to someone (paid outside SettleShort, e.g. a bank transfer) for a trip or event.
export const POST = route(
  async (req, ctx) => {
    const input = await body(
      req,
      z.object({ userId: z.string().uuid(), amountCents: z.number().int().positive().max(100_000_000), currency: z.string().length(3).toUpperCase(), purpose: z.string().trim().min(3).max(200), reference: z.string().trim().max(120).optional() }),
    );
    const [m] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.userId, input.userId)));
    if (!m) fail(400, "not_member", "They must be a workspace member");
    const [row] = await db.insert(advances).values({ ...input, workspaceId: ctx.workspace.id, issuedBy: ctx.user.id }).returning();
    await audit(ctx.workspace.id, ctx.user.id, "advance.issued", "advance", row.id, { amount: input.amountCents, currency: input.currency, purpose: input.purpose });
    return row;
  },
  { admin: true },
);
