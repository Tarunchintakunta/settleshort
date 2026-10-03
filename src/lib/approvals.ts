import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { fail } from "./api";
import { audit } from "./audit";
import { approvals, batches, batchItems, claimEvidence, claims, db, delegations, fixRequests, memberships, users } from "./db";
import { findContradictions, missingQuestions, type EvidenceFacts } from "./evidence";
import { obligationsFor } from "./ledger";
import { activeDelegations, approvalBlocker, approvalOutcome, diffSnapshots, hashSnapshot, type Approver, type Snapshot } from "./policy";

type Claim = typeof claims.$inferSelect;

/** Disagreements between this claim's evidence that nobody has accepted yet. */
export async function openContradictions(claim: Claim) {
  const ev = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, claim.id)).orderBy(claimEvidence.createdAt);
  const acked = new Set(claim.acknowledgedConflicts.map((a) => a.key));
  return findContradictions(ev.map((e) => ({ id: e.id, kind: e.kind, extract: e.extractJson as EvidenceFacts["extract"] }))).filter((c) => !acked.has(c.key));
}

/** Who is reimbursed how much for this claim (employee payers only). Single source for snapshots. */
export async function payeesOf(claim: Claim) {
  const o = await obligationsFor(claim);
  return o.payees.filter((p) => p.owedCents > 0).map((p) => ({ userId: p.userId, amountCents: p.owedCents }));
}

export async function currentSnapshot(claim: Claim): Promise<Snapshot> {
  const [ev, payees] = await Promise.all([db.select({ id: claimEvidence.id }).from(claimEvidence).where(eq(claimEvidence.claimId, claim.id)), payeesOf(claim)]);
  return { amountCents: claim.amountCents, currency: claim.currency, payees, evidenceIds: ev.map((e) => e.id) };
}

export async function activeApproval(claimId: string) {
  const [a] = await db.select().from(approvals).where(and(eq(approvals.claimId, claimId), isNull(approvals.invalidatedAt)));
  return a ?? null;
}

type WsPolicy = { id: string; alternateApproverId: string | null; receiptRequiredCents: number; secondApprovalAboveCents: number | null };

/**
 * The authority someone holds right now: their own role and limit, plus anyone who delegated to them and
 * whose cover hasn't expired. Read fresh at approval time, so a changed role or an old link can't approve.
 */
export async function authorityOf(workspaceId: string, userId: string) {
  const [own, dels] = await Promise.all([
    db.select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId))),
    db.select().from(delegations).where(and(eq(delegations.workspaceId, workspaceId), eq(delegations.toUserId, userId))),
  ]);
  const active = activeDelegations(userId, dels);
  const from = active.length ? await db.select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), inArray(memberships.userId, active.map((d) => d.fromUserId)))) : [];
  return [
    ...(own[0] ? [{ actingAs: userId, onBehalfOf: null as string | null, role: own[0].role, limit: own[0].approvalLimitCents }] : []),
    ...from.map((m) => ({ actingAs: m.userId, onBehalfOf: m.userId as string | null, role: m.role, limit: m.approvalLimitCents })),
  ];
}

export async function approveClaim(ws: WsPolicy, approver: Approver, claimId: string) {
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.workspaceId, ws.id)));
  if (!claim) fail(404, "not_found", "Claim not found");
  if (claim.status === "in_batch") {
    // Re-approval inside a batch that hasn't been released yet (after the final change check flagged it).
    const [b] = await db.select({ status: batches.status }).from(batchItems).innerJoin(batches, eq(batches.id, batchItems.batchId)).where(and(eq(batchItems.claimId, claimId), eq(batches.status, "awaiting_approval")));
    if (!b) fail(409, "locked", "This claim's batch has already been released");
  } else if (!["pending_review", "matched"].includes(claim.status)) fail(409, "locked", `Claim is ${claim.status} and can't be approved`);
  // Authority checked now, from the database (#25): own role and limit, or an unexpired delegation (#27).
  const payeeIds = (await payeesOf(claim)).map((p) => p.userId);
  const options = (await authorityOf(ws.id, approver.id)).filter(
    (a) => !approvalBlocker({ id: a.actingAs, role: a.role }, { submitterId: claim.submitterId, payeeIds }, ws.alternateApproverId) && !approvalBlocker({ id: approver.id, role: a.role }, { submitterId: claim.submitterId, payeeIds }, ws.alternateApproverId),
  );
  if (!options.length) {
    const blocked = approvalBlocker({ id: approver.id, role: approver.role }, { submitterId: claim.submitterId, payeeIds }, ws.alternateApproverId);
    fail(403, blocked?.code ?? "forbidden", blocked?.message ?? "You don't have approval authority in this workspace");
  }
  // Use the widest authority available: unlimited beats any limit.
  const best = options.reduce((a, b) => (a.limit == null ? a : b.limit == null ? b : a.limit >= b.limit ? a : b));

  if (claim.duplicateOfId) fail(409, "possible_duplicate", "This looks like a duplicate. Merge it or mark it a different expense before approving.");
  const kinds = (await db.select({ k: claimEvidence.kind }).from(claimEvidence).where(eq(claimEvidence.claimId, claimId))).map((r) => r.k);
  const missing = missingQuestions(claim, { kinds, receiptRequiredCents: ws.receiptRequiredCents });
  if (missing.length) fail(409, "missing_info", `Still needed before approval: ${missing.map((m) => m.question).join(" ")}`);
  const fixes = await db.select().from(fixRequests).where(and(eq(fixRequests.claimId, claimId), isNull(fixRequests.resolvedAt)));
  if (fixes.length) fail(409, "fix_requested", `Waiting on a requested fix: ${fixes.map((f) => f.message).join("; ")}`);
  const open = await openContradictions(claim);
  if (open.length) fail(409, "contradiction", `Resolve conflicting evidence first: ${open.map((c) => c.message).join("; ")}`);

  const snap = await currentSnapshot(claim);
  const hash = hashSnapshot(snap);
  const active = await db.select().from(approvals).where(and(eq(approvals.claimId, claimId), isNull(approvals.invalidatedAt)));
  const mine = active.find((a) => a.approverId === approver.id);
  if (mine?.snapshotHash === hash && claim.status !== "pending_review") return { ...claim, approvalNeeded: null };
  // A person's newer sign-off replaces their older one; other people's sign-offs on the same snapshot stay.
  if (mine) await db.update(approvals).set({ invalidatedAt: new Date(), invalidReason: "Superseded by a new approval" }).where(eq(approvals.id, mine.id));
  const [row] = await db
    .insert(approvals)
    .values({ workspaceId: ws.id, claimId, approverId: approver.id, onBehalfOfId: best.onBehalfOf, coversCents: best.limit, snapshotHash: hash, snapshotJson: snap })
    .returning();

  const payable = snap.payees.reduce((a, p) => a + p.amountCents, 0);
  const signOffs = [...active.filter((a) => a.id !== mine?.id && a.snapshotHash === hash), row].map((a) => ({ approverId: a.approverId, coversCents: a.coversCents }));
  const outcome = approvalOutcome(payable, signOffs, ws.secondApprovalAboveCents);
  if (!outcome.approved) {
    await audit(ws.id, approver.id, "claim.endorsed", "claim", claimId, { needed: outcome.needed, on_behalf_of: best.onBehalfOf ?? undefined });
    return { ...claim, approvalNeeded: outcome.needed };
  }
  const [updated] = await db
    .update(claims)
    .set({ status: claim.status === "in_batch" ? "in_batch" : "matched", updatedAt: new Date() })
    .where(eq(claims.id, claimId))
    .returning();
  await audit(ws.id, approver.id, "claim.approved", "claim", claimId, { amount: snap.amountCents, currency: snap.currency, on_behalf_of: best.onBehalfOf ?? undefined });
  return { ...updated, approvalNeeded: null };
}

const nameMap = async (ids: string[]) => {
  if (!ids.length) return (u: string) => u;
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  return (u: string) => rows.find((r) => r.id === u)?.name ?? "Unknown";
};

/** What changed since the active approval. `null` means no approval exists at all. */
export async function changesSinceApproval(claim: Claim): Promise<string[] | null> {
  const a = await activeApproval(claim.id);
  if (!a) return null;
  const now = await currentSnapshot(claim);
  if (hashSnapshot(now) === a.snapshotHash) return [];
  const before = a.snapshotJson as Snapshot;
  return diffSnapshots(before, now, await nameMap([...before.payees, ...now.payees].map((p) => p.userId)));
}

/**
 * Call after any change to a claim. A material change voids the approval and sends the claim back
 * for review; the diff is kept on the approval row and in the audit log.
 */
export async function revalidateApproval(workspaceId: string, claimId: string, actorId: string | null) {
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  const changes = await changesSinceApproval(claim);
  if (!changes?.length) return claim;
  const reason = changes.join("; ");
  await db.update(approvals).set({ invalidatedAt: new Date(), invalidReason: reason }).where(and(eq(approvals.claimId, claimId), isNull(approvals.invalidatedAt)));
  // A batched claim stays in its batch; the release-time check blocks it until re-approved.
  const [updated] = await db
    .update(claims)
    .set({ status: claim.status === "matched" ? "pending_review" : claim.status, updatedAt: new Date() })
    .where(eq(claims.id, claimId))
    .returning();
  await audit(workspaceId, actorId, "claim.approval_invalidated", "claim", claimId, { changes });
  return updated;
}

/** Final change check for a set of claims: everything that would make paying them unsafe. */
export async function releaseProblems(workspaceId: string, claimIds: string[]) {
  const rows = claimIds.length ? await db.select().from(claims).where(and(eq(claims.workspaceId, workspaceId), inArray(claims.id, claimIds))) : [];
  const out: { claimId: string; number: number; problems: string[] }[] = [];
  for (const c of rows) {
    const changes = await changesSinceApproval(c);
    let problems = changes ?? [];
    if (changes === null) {
      const [voided] = await db.select().from(approvals).where(eq(approvals.claimId, c.id)).orderBy(desc(approvals.createdAt)).limit(1);
      problems = [voided?.invalidReason ? `Approval voided: ${voided.invalidReason}` : "Not approved yet"];
    }
    if (problems.length) out.push({ claimId: c.id, number: c.number, problems });
  }
  return out.sort((a, b) => a.number - b.number);
}
