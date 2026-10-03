// Pure: who a claim is waiting on, why, and the smallest action that unblocks it. Unit-tested.
import type { Truth } from "./status";

export type Role = "claimant" | "approver" | "releaser" | "receiver" | "finance";
export type Blocker = { waitingOn: Role; why: string; action: string };

/** Every reminder says exactly what is blocking the claim and the one thing that unblocks it. */
export function blockerFor(t: Truth, extra: { missing?: string[]; contradictions?: string[]; duplicate?: boolean; batchName?: string } = {}): Blocker | null {
  switch (t.key) {
    case "fix_requested":
      return { waitingOn: "claimant", why: t.detail, action: "Fix it and reply on the claim" };
    case "needs_review":
      if (extra.missing?.length) return { waitingOn: "claimant", why: `Missing: ${extra.missing[0]}`, action: "Answer that one question" };
      if (extra.contradictions?.length) return { waitingOn: "approver", why: extra.contradictions[0], action: "Fix the claim or accept the difference with a reason" };
      if (extra.duplicate) return { waitingOn: "approver", why: "It may duplicate another claim", action: "Merge it or mark it a different expense" };
      return { waitingOn: "approver", why: "The AI was unsure about some fields", action: "Check the highlighted fields, then approve" };
    case "submitted":
      return extra.missing?.length
        ? { waitingOn: "claimant", why: `Missing: ${extra.missing[0]}`, action: "Answer that one question" }
        : { waitingOn: "approver", why: "Waiting for an approval", action: "Approve, approve less, or ask for a fix" };
    case "approved":
    case "partially_paid":
    case "failed":
      return { waitingOn: "finance", why: t.key === "failed" ? "The PayPal payout failed" : "Approved money is still owed", action: "Put it in the next payout batch" };
    case "scheduled":
      return { waitingOn: "releaser", why: `In ${extra.batchName ?? "a batch"} waiting for release`, action: "Release the batch to PayPal" };
    case "verifying":
      return { waitingOn: "finance", why: "PayPal didn't confirm the payout", action: "Verify with PayPal (never resend)" };
    case "unclaimed":
      return { waitingOn: "receiver", why: "PayPal sent it but it hasn't been accepted", action: "Accept the payout in your PayPal account" };
    case "paid":
      return { waitingOn: "receiver", why: "PayPal says it's paid", action: "Confirm it arrived, or report it missing" };
    case "investigating":
      return { waitingOn: "finance", why: "Reported missing after PayPal said paid", action: "Check the PayPal transaction and resolve the investigation" };
    case "owes_back":
      return { waitingOn: "receiver", why: "A refund arrived after reimbursement", action: "Return the refund to the company" };
    default:
      return null;
  }
}

/** When an overdue claim moves up the chain: the next person, never everyone. */
export function escalationTarget(responsible: string, chain: Record<string, string | null>, ownerId: string): string | null {
  const next = chain[responsible] ?? (responsible !== ownerId ? ownerId : null);
  return next && next !== responsible ? next : null;
}
