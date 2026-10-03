import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, memberships } from "@/lib/db";

export const PATCH = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const input = await body(
      req,
      z.object({ role: z.enum(["admin", "member"]).optional(), paypalReceiverEmail: z.string().trim().email().optional(), canRelease: z.boolean().optional() }),
    );
    const [m] = await db.select().from(memberships).where(and(eq(memberships.id, id), eq(memberships.workspaceId, ctx.workspace.id)));
    if (!m) fail(404, "not_found", "Member not found");
    if (m.role === "owner" && input.role) fail(400, "owner_role", "Owner role cannot be changed");
    if (input.canRelease !== undefined) {
      const [me] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.userId, ctx.user.id)));
      if (!me?.canRelease) fail(403, "forbidden", "Only people with release authority can grant or remove it");
      if (m.userId === ctx.user.id && !input.canRelease) fail(400, "last_releaser", "You can't remove your own release authority");
    }
    const [updated] = await db.update(memberships).set(input).where(eq(memberships.id, id)).returning();
    await audit(ctx.workspace.id, ctx.user.id, "member.updated", "membership", id, input);
    return updated;
  },
  { admin: true },
);
