// Pure approval rules: who may approve, and what an approval covers. No DB access; unit-tested.
import { createHash } from "node:crypto";
import { formatMoney } from "./money";

/** What an approver signed off on. A material change to any of it voids the approval. */
export type Snapshot = {
  amountCents: number;
  currency: string;
  payees: { userId: string; amountCents: number }[];
  evidenceIds: string[];
};

export function normalizeSnapshot(s: Snapshot): Snapshot {
  return {
    amountCents: s.amountCents,
    currency: s.currency,
    payees: [...s.payees].sort((a, b) => a.userId.localeCompare(b.userId)),
    evidenceIds: [...s.evidenceIds].sort(),
  };
}

export const hashSnapshot = (s: Snapshot) => createHash("sha256").update(JSON.stringify(normalizeSnapshot(s))).digest("hex");

/** Human-readable list of what changed between the approved snapshot and now. Empty = unchanged. */
export function diffSnapshots(before: Snapshot, after: Snapshot, nameOf: (userId: string) => string = (u) => u): string[] {
  const out: string[] = [];
  if (before.amountCents !== after.amountCents || before.currency !== after.currency)
    out.push(`Amount changed from ${formatMoney(before.amountCents, before.currency)} to ${formatMoney(after.amountCents, after.currency)}`);
  const pay = (s: Snapshot) => new Map(s.payees.map((p) => [p.userId, p.amountCents]));
  const [b, a] = [pay(before), pay(after)];
  for (const [u, cents] of a) {
    if (!b.has(u)) out.push(`New recipient ${nameOf(u)} (${formatMoney(cents, after.currency)})`);
    else if (b.get(u) !== cents) out.push(`${nameOf(u)} now receives ${formatMoney(cents, after.currency)} instead of ${formatMoney(b.get(u)!, before.currency)}`);
  }
  for (const u of b.keys()) if (!a.has(u)) out.push(`${nameOf(u)} removed as a recipient`);
  const added = after.evidenceIds.filter((e) => !before.evidenceIds.includes(e)).length;
  const removed = before.evidenceIds.filter((e) => !after.evidenceIds.includes(e)).length;
  if (added) out.push(`${added} piece${added === 1 ? "" : "s"} of evidence added`);
  if (removed) out.push(`${removed} piece${removed === 1 ? "" : "s"} of evidence removed`);
  return out;
}

export type Approver = { id: string; role: "owner" | "admin" | "member" };

/**
 * Maker-checker: nobody approves a claim they submitted or are paid by. Admins approve; the workspace's
 * alternate approver may approve too (that is how a founder's own claims get approved).
 * Returns why the approval is blocked, or null when allowed.
 */
export function approvalBlocker(
  approver: Approver,
  claim: { submitterId: string; payeeIds: string[] },
  alternateApproverId: string | null,
): { code: "self_approval" | "forbidden"; message: string } | null {
  if (approver.id === claim.submitterId || claim.payeeIds.includes(approver.id))
    return {
      code: "self_approval",
      message: alternateApproverId && alternateApproverId !== approver.id
        ? "You can't approve your own claim. Your alternate approver or another admin has to."
        : "You can't approve your own claim. Another admin has to, or set an alternate approver in Settings.",
    };
  if (approver.role === "member" && approver.id !== alternateApproverId) return { code: "forbidden", message: "Only admins or the alternate approver can approve claims" };
  return null;
}

/** One sign-off and the authority it carried. `coversCents` null = no limit. */
export type SignOff = { approverId: string; coversCents: number | null };

/**
 * Whether the sign-offs so far fully approve this amount: someone whose limit covers it, and, above the
 * workspace's second-approval threshold, two different people. Otherwise says what is still needed.
 */
export function approvalOutcome(amountCents: number, signOffs: SignOff[], secondApprovalAboveCents: number | null): { approved: true } | { approved: false; needed: string } {
  const covered = signOffs.some((s) => s.coversCents == null || s.coversCents >= amountCents);
  const people = new Set(signOffs.map((s) => s.approverId)).size;
  if (!covered) return { approved: false, needed: "an approver whose limit covers this amount" };
  if (secondApprovalAboveCents != null && amountCents > secondApprovalAboveCents && people < 2) return { approved: false, needed: "a second approver (two people sign off above the threshold)" };
  return { approved: true };
}

export type Delegation = { fromUserId: string; toUserId: string; startsAt: Date; endsAt: Date };

/** Delegations active right now for this person. Expired ones simply stop counting. */
export const activeDelegations = (userId: string, all: Delegation[], now = new Date()) => all.filter((d) => d.toUserId === userId && d.startsAt <= now && d.endsAt > now);
