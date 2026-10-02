"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { endSession, getCtx, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { db, memberships, users, workspaces } from "@/lib/db";

export type FormState = { error?: string } | undefined;

const Creds = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

async function firstWorkspace(userId: string) {
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
  return m?.workspaceId ?? null;
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Creds.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) return { error: "Wrong email or password" };
  await startSession(user.id, await firstWorkspace(user.id));
  redirect("/app");
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Creds.extend({ name: z.string().trim().min(1, "Enter your name").max(80) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing?.passwordHash) return { error: "An account with this email exists, sign in instead" };
  const passwordHash = await hashPassword(password);
  // Invited users (no password yet) claim their account here.
  const [user] = existing
    ? await db.update(users).set({ passwordHash, name }).where(eq(users.id, existing.id)).returning()
    : await db.insert(users).values({ email, name, passwordHash }).returning();
  const wid = await firstWorkspace(user.id);
  await startSession(user.id, wid);
  redirect(wid ? "/app" : "/onboarding");
}

export async function createWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  const parsed = z
    .object({ name: z.string().trim().min(2, "Name your workspace").max(80), paypalEmail: z.string().trim().email("Enter your PayPal sandbox email").or(z.literal("")) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
  const [ws] = await db
    .insert(workspaces)
    .values({
      name: parsed.data.name,
      slug,
      maxSingleCents: Number(process.env.MAX_SINGLE_PAYOUT_CENTS ?? 50000),
      maxBatchCents: Number(process.env.MAX_BATCH_TOTAL_CENTS ?? 200000),
    })
    .returning();
  await db.insert(memberships).values({ workspaceId: ws.id, userId: ctx.user.id, role: "owner", paypalReceiverEmail: parsed.data.paypalEmail || ctx.user.email });
  await audit(ws.id, ctx.user.id, "workspace.created", "workspace", ws.id, { name: ws.name });
  await startSession(ctx.user.id, ws.id);
  redirect("/app/members?welcome=1");
}

export async function logout() {
  await endSession();
  redirect("/");
}
