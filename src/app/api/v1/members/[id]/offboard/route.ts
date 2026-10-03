import { and, eq, gt, or } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, delegations, memberships } from "@/lib/db";
import { offboardingReport } from "@/lib/offboarding";

async function load(workspaceId: string, id: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, id), eq(memberships.workspaceId, workspaceId)));
  if (!m) fail(404, "not_found", "Member not found");
  return m!;
}

// Preview what's unresolved with this person before they leave.
export const GET = route<{ id: string }>(async (_req, ctx, { id }) => offboardingReport(ctx.workspace, (await load(ctx.workspace.id, id)).userId), { admin: true });

// Removes app access and ends their delegations. Money owed to or by them stays on the books until settled.
export const POST = route<{ id: string }>(
  async (_req, ctx, { id }) => {
    const m = await load(ctx.workspace.id, id);
    if (m.role === "owner") fail(400, "owner", "The owner can't be offboarded");
    if (m.userId === ctx.user.id) fail(400, "self", "Someone else has to offboard you");
    const report = await offboardingReport(ctx.workspace, m.userId);
    await db.update(memberships).set({ offboardedAt: new Date(), canRelease: false }).where(eq(memberships.id, id));
    await db
      .update(delegations)
      .set({ endsAt: new Date() })
      .where(and(eq(delegations.workspaceId, ctx.workspace.id), gt(delegations.endsAt, new Date()), or(eq(delegations.fromUserId, m.userId), eq(delegations.toUserId, m.userId))));
    await audit(ctx.workspace.id, ctx.user.id, "member.offboarded", "membership", id, {
      owed_to_them: report.owedToThem.length,
      owed_by_them: report.owedByThem.length,
      subscriptions: report.subscriptions.map((s) => s.vendor),
    });
    return report;
  },
  { admin: true },
);
