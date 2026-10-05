import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { audit } from "./audit";
import { factsFor } from "./claim-facts";
import { missingQuestions } from "./evidence";
import { claimEvidence, claimPayments, claims, db, memberships, users, workspaces } from "./db";
import { formatMoney } from "./money";
import { blockerFor, escalationTarget, type Blocker } from "./reminders";
import { claimTitle } from "./title";

type Ws = typeof workspaces.$inferSelect;
const DAY = 86_400_000;

/** Posts to the workspace's Slack incoming webhook when one is configured; otherwise reminders stay in-app. */
export async function notify(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
  return true;
}

/** Each open claim with what it's waiting on, why, and the smallest action. */
export async function openBlockers(ws: Ws) {
  const rows = await db.select().from(claims).where(and(eq(claims.workspaceId, ws.id), inArray(claims.status, ["pending_review", "matched", "in_batch", "partially_paid", "paid", "failed"])));
  const [facts, ev] = await Promise.all([factsFor(rows), rows.length ? db.select().from(claimEvidence).where(inArray(claimEvidence.claimId, rows.map((r) => r.id))) : []]);
  return rows.flatMap((c) => {
    const missing = missingQuestions(c, { kinds: ev.filter((e) => e.claimId === c.id).map((e) => e.kind), receiptRequiredCents: ws.receiptRequiredCents }).map((q) => q.question);
    const b = blockerFor(facts.get(c.id)!.truth, { missing, duplicate: !!c.duplicateOfId });
    return b ? [{ claim: c, blocker: b }] : [];
  });
}

/** What is waiting on this person specifically. */
export async function waitingOn(ws: Ws, userId: string, isAdmin: boolean) {
  const [me] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, userId)));
  const paid = await db.select({ claimId: claimPayments.claimId }).from(claimPayments).where(eq(claimPayments.userId, userId));
  const mine = (c: typeof claims.$inferSelect) => c.submitterId === userId || c.payerUserId === userId || paid.some((p) => p.claimId === c.id);
  const approver = isAdmin || ws.alternateApproverId === userId;
  const fits = (c: typeof claims.$inferSelect, b: Blocker) =>
    b.waitingOn === "claimant" ? c.submitterId === userId || c.payerUserId === userId
    : b.waitingOn === "receiver" ? mine(c)
    : b.waitingOn === "approver" ? approver && !mine(c) && (!c.escalatedToUserId || c.escalatedToUserId === userId)
    : b.waitingOn === "releaser" ? !!me?.canRelease
    : isAdmin;
  return (await openBlockers(ws)).filter(({ claim, blocker }) => fits(claim, blocker));
}

/**
 * Overdue approvals move to the next responsible person (their manager, else the owner), with context.
 * Idempotent: a claim escalates at most once per escalation period.
 */
export async function runEscalations(ws: Ws) {
  const cutoff = Date.now() - ws.escalationDays * DAY;
  const [ms, owner] = await Promise.all([
    db.select().from(memberships).where(eq(memberships.workspaceId, ws.id)),
    db.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.workspaceId, ws.id), eq(memberships.role, "owner"))),
  ]);
  const ownerId = owner[0]?.id;
  if (!ownerId) return 0;
  const chain = Object.fromEntries(ms.map((m) => [m.userId, m.escalatesToUserId]));
  let moved = 0;
  for (const { claim: c, blocker } of await openBlockers(ws)) {
    if (blocker.waitingOn !== "approver") continue;
    const since = (c.escalatedAt ?? c.createdAt).getTime();
    if (since > cutoff) continue;
    const responsible = c.escalatedToUserId ?? c.budgetOwnerUserId ?? ownerId;
    const target = c.escalatedToUserId || c.budgetOwnerUserId ? escalationTarget(responsible, chain, ownerId) : ownerId;
    if (!target || target === c.escalatedToUserId || [c.submitterId, c.payerUserId].includes(target)) continue;
    const [won] = await db
      .update(claims)
      .set({ escalatedToUserId: target, escalatedAt: new Date() })
      // Compare-and-set on escalatedAt: two concurrent runs escalate once.
      .where(and(eq(claims.id, c.id), c.escalatedAt ? eq(claims.escalatedAt, c.escalatedAt) : isNull(claims.escalatedAt)))
      .returning();
    if (!won) continue;
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, target));
    const days = Math.floor((Date.now() - c.createdAt.getTime()) / DAY);
    const context = `#${c.number} ${c.vendor ? `${c.vendor} ${formatMoney(c.amountCents, c.currency)}` : claimTitle(c)} has waited ${days} days. ${blocker.why}. Next step: ${blocker.action}.`;
    await audit(ws.id, null, "claim.escalated", "claim", c.id, { to: u?.name, context });
    await notify(`Escalated to ${u?.name}: ${context}`);
    moved++;
  }
  return moved;
}
