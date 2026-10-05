import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, memberships, sessions, users, workspaces } from "./db";

export { hashPassword, verifyPassword } from "./password";

// Sessions live in Postgres. The cookie holds a random 256-bit token; the DB stores only an HMAC of it
// keyed by SESSION_SECRET, so logout and revocation are real and a database leak can't be replayed as cookies.
const COOKIE = "ss_session";
const TTL_MS = 7 * 86_400_000;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return s ?? "dev-only-insecure-secret-change-me";
};
const sha256 = (t: string) => createHmac("sha256", secret()).update(t).digest("hex");

export async function startSession(userId: string, workspaceId: string | null) {
  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  if (old) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(old)));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, workspaceId, expiresAt });
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(COOKIE);
}

async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [s] = await db
    .select({ userId: sessions.userId, workspaceId: sessions.workspaceId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  return s ?? null;
}

export type Ctx = Awaited<ReturnType<typeof getCtx>>;

/** Current user + workspace + role. Membership is re-checked on every request (IDOR guard). */
export async function getCtx() {
  const s = await readSession();
  if (!s) return null;
  const [user] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!user) return null;
  if (!s.workspaceId) return { user, workspace: null, role: null, isAdmin: false } as const;
  const [row] = await db
    .select({ workspace: workspaces, role: memberships.role, offboardedAt: memberships.offboardedAt })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.workspaceId, s.workspaceId)));
  if (!row || row.offboardedAt) return { user, workspace: null, role: null, isAdmin: false } as const;
  return { user, workspace: row.workspace, role: row.role, isAdmin: row.role !== "member" } as const;
}

/** For pages: redirect when not signed in / no workspace. */
export async function requirePageCtx() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.workspace) redirect("/onboarding");
  return ctx as typeof ctx & { workspace: NonNullable<typeof ctx.workspace> };
}
