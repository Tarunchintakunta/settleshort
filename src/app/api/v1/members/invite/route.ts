import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, memberships, users } from "@/lib/db";

// Creates (or reuses) the user. Someone without a password gets a one-time invite link (14 days) that the
// admin shares; signup refuses to claim an invited email without it.
export const POST = route(
  async (req, ctx) => {
    const input = await body(
      req,
      z.object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["admin", "member"]).default("member"),
        paypalEmail: z.string().trim().email().optional().or(z.literal("")),
      }),
    );
    let [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user) [user] = await db.insert(users).values({ email: input.email, name: input.name }).returning();
    const [existing] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, ctx.workspace.id), eq(memberships.userId, user.id)));
    if (existing) fail(409, "exists", "Already a member");
    const [m] = await db
      .insert(memberships)
      .values({ workspaceId: ctx.workspace.id, userId: user.id, role: input.role, paypalReceiverEmail: input.paypalEmail || input.email })
      .returning();
    await audit(ctx.workspace.id, ctx.user.id, "member.invited", "membership", m.id, { email: input.email, role: input.role });
    if (user.passwordHash) return { ...m, inviteUrl: null };
    const token = randomBytes(24).toString("base64url");
    await db
      .update(users)
      .set({ inviteTokenHash: createHash("sha256").update(token).digest("hex"), inviteExpiresAt: new Date(Date.now() + 14 * 86_400_000) })
      .where(eq(users.id, user.id));
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return { ...m, inviteUrl: `${origin}/signup?invite=${token}` };
  },
  { admin: true },
);
