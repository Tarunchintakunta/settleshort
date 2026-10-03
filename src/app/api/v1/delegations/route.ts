import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, delegations, memberships } from "@/lib/db";

export const GET = route(async (_req, ctx) => db.select().from(delegations).where(eq(delegations.workspaceId, ctx.workspace.id)));

// Holiday cover: hand your approval authority to someone until a date. It expires on its own.
export const POST = route(async (req, ctx) => {
  const { toUserId, endsAt } = await body(req, z.object({ toUserId: z.string().uuid(), endsAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)) }));
  if (toUserId === ctx.user.id) fail(400, "self", "Pick someone else to cover for you");
  if (ctx.role === "member") fail(403, "forbidden", "Only approvers can delegate approval authority");
  const [to] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.userId, toUserId)));
  if (!to) fail(400, "not_member", "They must be a workspace member");
  const end = new Date(endsAt.length === 10 ? `${endsAt}T23:59:59Z` : endsAt);
  if (end <= new Date() || end.getTime() - Date.now() > 60 * 86_400_000) fail(400, "bad_end", "Cover must end in the future and within 60 days");
  const [row] = await db.insert(delegations).values({ workspaceId: ctx.workspace.id, fromUserId: ctx.user.id, toUserId, startsAt: new Date(), endsAt: end }).returning();
  await audit(ctx.workspace.id, ctx.user.id, "delegation.created", "delegation", row.id, { to: toUserId, until: end.toISOString() });
  return row;
});
