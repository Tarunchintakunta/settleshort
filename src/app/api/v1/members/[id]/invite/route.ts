import { and, eq, ne } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, memberships, users } from "@/lib/db";
import { issueInvite } from "@/lib/invites";

const pendingMember = async (workspaceId: string, membershipId: string) => {
  const [row] = await db
    .select({ m: memberships, u: users })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.id, membershipId), eq(memberships.workspaceId, workspaceId)));
  if (!row) fail(404, "not_found", "Member not found");
  if (row!.u.passwordHash) fail(409, "already_joined", "They already have an account and can sign in");
  return row!;
};

// Resend: a new one-time link; the old one stops working.
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const { u } = await pendingMember(ctx.workspace.id, id);
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const { url, emailed } = await issueInvite(u.id, ctx.workspace.id, ctx.user.name, origin);
    await audit(ctx.workspace.id, ctx.user.id, "member.invite_resent", "membership", id, { email: u.email, emailed });
    return { inviteUrl: url, emailed };
  },
  { admin: true },
);

// Revoke: removes the pending membership; the invite link stops working if they belong nowhere else.
export const DELETE = route<{ id: string }>(
  async (_req, ctx, { id }) => {
    const { u } = await pendingMember(ctx.workspace.id, id);
    await db.delete(memberships).where(eq(memberships.id, id));
    const [other] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, u.id), ne(memberships.id, id)));
    if (!other) await db.update(users).set({ inviteTokenHash: null, inviteExpiresAt: null }).where(eq(users.id, u.id));
    await audit(ctx.workspace.id, ctx.user.id, "member.invite_revoked", "membership", id, { email: u.email });
    return { ok: true };
  },
  { admin: true },
);
