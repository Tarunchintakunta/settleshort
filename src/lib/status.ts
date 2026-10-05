// Pure "where's my money" logic: one truthful status and a timeline per claim. Unit-tested.

export type MoneyState = "unpaid" | "partially_paid" | "paid" | "owes_back" | "nothing_owed";
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export type ClaimFacts = {
  status: string;
  flagged: boolean;
  createdAt: Date;
  approvedAt: Date | null;
  /** Latest batch the claim is in, if any. */
  batch: { status: string; createdAt: Date; sentAt: Date | null } | null;
  /** That batch's PayPal item statuses for this claim. */
  itemStatuses: string[];
  paidAt: Date | null;
  confirmedAt: Date | null;
  notReceivedAt: Date | null;
  money: MoneyState;
  /** Open fix requests from an approver (what the claimant must do). */
  openFixes?: string[];
};

export type Truth = { key: string; label: string; detail: string; tone: Tone };

// Labels follow the one app vocabulary: Draft, Needs review, Approved, In batch, Paid, Failed (plus rarer exception states).
/** One status a person can trust, distinguishing every stage between submitted and confirmed received. */
export function truthfulStatus(f: ClaimFacts): Truth {
  if (f.status === "rejected") return { key: "rejected", label: "Rejected", detail: "This claim won't be paid.", tone: "neutral" };
  if (f.status === "draft") return { key: "draft", label: "Draft", detail: "Not submitted yet.", tone: "neutral" };
  if (f.status === "pending_review" && f.openFixes?.length)
    return { key: "fix_requested", label: "Fix requested", detail: `Waiting on the claimant: ${f.openFixes.join("; ")}`, tone: "warning" };
  if (f.status === "pending_review")
    return f.flagged
      ? { key: "needs_review", label: "Needs review", detail: "Something needs a human look before it can be approved.", tone: "warning" }
      : { key: "submitted", label: "Needs review", detail: "Waiting for an approver.", tone: "accent" };
  if (f.money === "owes_back") return { key: "owes_back", label: "Refund owed back", detail: "A refund arrived after reimbursement; the difference is owed to the company.", tone: "warning" };
  if (f.notReceivedAt && f.status === "paid") return { key: "investigating", label: "Under investigation", detail: "PayPal reports it paid, but the money hasn't arrived. Finance is checking.", tone: "danger" };
  if (f.status === "paid")
    return f.confirmedAt
      ? { key: "received", label: "Received", detail: "Confirmed received.", tone: "success" }
      : f.money === "nothing_owed"
        ? { key: "settled", label: "Settled", detail: "Nothing was owed to employees.", tone: "success" }
        : { key: "paid", label: "Paid", detail: "PayPal completed the payout. Waiting for the receiver to confirm.", tone: "success" };
  if (f.status === "partially_paid") return { key: "partially_paid", label: "Partially paid", detail: "Part of the money has been repaid; the rest is still owed.", tone: "warning" };
  if (f.status === "failed") return { key: "failed", label: "Failed", detail: "PayPal couldn't pay it. It's owed again and goes into the next batch.", tone: "danger" };
  if (f.status === "matched") return { key: "approved", label: "Approved", detail: "Approved; waiting to be scheduled into a payout batch.", tone: "accent" };
  if (f.status === "in_batch" && f.batch) {
    if (f.itemStatuses.includes("UNCLAIMED")) return { key: "unclaimed", label: "Unclaimed at PayPal", detail: "PayPal sent it, but the receiver hasn't accepted it in their PayPal account.", tone: "warning" };
    if (f.batch.status === "awaiting_approval") return { key: "scheduled", label: "In batch", detail: "In a batch waiting for someone with release authority.", tone: "accent" };
    if (f.batch.status === "unknown") return { key: "verifying", label: "Verifying with PayPal", detail: "PayPal didn't answer in time. Nothing will be resent until the outcome is known.", tone: "warning" };
    return { key: "processing", label: "In batch", detail: "Sent to PayPal; waiting for PayPal to finish.", tone: "accent" };
  }
  return { key: f.status, label: f.status.replace(/_/g, " "), detail: "", tone: "neutral" };
}

export type Step = { label: string; at: Date | null; done: boolean };

export function claimTimeline(f: ClaimFacts): Step[] {
  const sent = f.batch?.sentAt ?? null;
  return [
    { label: "Submitted", at: f.createdAt, done: true },
    { label: "Approved", at: f.approvedAt, done: !!f.approvedAt },
    { label: "Scheduled in a batch", at: f.batch?.createdAt ?? null, done: !!f.batch },
    { label: "Sent to PayPal", at: sent, done: !!sent },
    { label: "Paid", at: f.paidAt, done: ["paid", "owes_back"].includes(f.money) || f.status === "paid" },
    { label: f.notReceivedAt ? "Reported not received" : "Confirmed received", at: f.notReceivedAt ?? f.confirmedAt, done: !!(f.confirmedAt || f.notReceivedAt) },
  ];
}
