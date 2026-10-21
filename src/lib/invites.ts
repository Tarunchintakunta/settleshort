import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, memberships, users, workspaces } from "./db";
import { sendMail } from "./notify";

const INVITE_DAYS = 14;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** A fresh one-time link (the old one stops working), emailed when SMTP is configured. */
export async function issueInvite(userId: string, workspaceId: string, inviterName: string, origin: string) {
  const token = randomBytes(24).toString("base64url");
  await db.update(users).set({ inviteTokenHash: sha(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) }).where(eq(users.id, userId));
  const url = `${origin}/signup?invite=${token}`;
  const [[u], [ws]] = await Promise.all([db.select().from(users).where(eq(users.id, userId)), db.select().from(workspaces).where(eq(workspaces.id, workspaceId))]);
  const emailed = await sendMail(
    u.email,
    `${inviterName} invited you to ${ws.name} on SettleShort`,
    `${inviterName} added you to ${ws.name} on SettleShort, where receipts become approved PayPal payouts.\n\nSet your password here (the link works once and expires in ${INVITE_DAYS} days):\n${url}\n\nIf you weren't expecting this, ignore it.`,
  );
  return { url, emailed };
}

/** What an invite link is for, so the signup page can say it. Null when the link is unknown, used or expired. */
export async function inviteByToken(token: string) {
  const [u] = await db.select().from(users).where(and(eq(users.inviteTokenHash, sha(token)), gt(users.inviteExpiresAt, new Date())));
  if (!u || u.passwordHash) return null;
  const [m] = await db
    .select({ workspaceName: workspaces.name, workspaceId: workspaces.id })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, u.id))
    .orderBy(memberships.createdAt);
  const [owner] = m ? await db.select({ name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(and(eq(memberships.workspaceId, m.workspaceId), eq(memberships.role, "owner"))) : [];
  return { email: u.email, name: u.name, workspaceName: m?.workspaceName ?? null, inviterName: owner?.name ?? null };
}
