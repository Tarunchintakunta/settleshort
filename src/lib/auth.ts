import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, memberships, users, workspaces } from "./db";

const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const COOKIE = "ss_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return new TextEncoder().encode(s ?? "dev-only-insecure-secret-change-me");
};

export async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(pw, salt, 64)).toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const got = await scrypt(pw, salt, 64);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export async function startSession(userId: string, workspaceId: string | null) {
  const token = await new SignJWT({ wid: workspaceId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.sub!, workspaceId: (payload.wid as string | null) ?? null };
  } catch {
    return null;
  }
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
    .select({ workspace: workspaces, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.workspaceId, s.workspaceId)));
  if (!row) return { user, workspace: null, role: null, isAdmin: false } as const;
  return { user, workspace: row.workspace, role: row.role, isAdmin: row.role !== "member" } as const;
}

/** For pages: redirect when not signed in / no workspace. */
export async function requirePageCtx() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.workspace) redirect("/onboarding");
  return ctx as typeof ctx & { workspace: NonNullable<typeof ctx.workspace> };
}
