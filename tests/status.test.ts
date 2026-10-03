import { describe, expect, it } from "vitest";
import { claimTimeline, truthfulStatus, type ClaimFacts } from "../src/lib/status";

const t0 = new Date("2026-10-01T10:00:00Z");
const base: ClaimFacts = { status: "pending_review", flagged: false, createdAt: t0, approvedAt: null, batch: null, itemStatuses: [], paidAt: null, confirmedAt: null, notReceivedAt: null, money: "unpaid" };

describe("truthful status", () => {
  it("separates every stage", () => {
    expect(truthfulStatus(base).key).toBe("submitted");
    expect(truthfulStatus({ ...base, flagged: true }).key).toBe("needs_review");
    expect(truthfulStatus({ ...base, status: "matched", approvedAt: t0 }).key).toBe("approved");
    const batch = { status: "awaiting_approval", createdAt: t0, sentAt: null };
    expect(truthfulStatus({ ...base, status: "in_batch", batch }).key).toBe("scheduled");
    expect(truthfulStatus({ ...base, status: "in_batch", batch: { ...batch, status: "submitted", sentAt: t0 } }).key).toBe("processing");
    expect(truthfulStatus({ ...base, status: "in_batch", batch: { ...batch, status: "unknown" } }).key).toBe("verifying");
    expect(truthfulStatus({ ...base, status: "failed" }).key).toBe("failed");
    expect(truthfulStatus({ ...base, status: "paid", money: "paid" }).key).toBe("paid");
    expect(truthfulStatus({ ...base, status: "paid", money: "paid", confirmedAt: t0 }).key).toBe("received");
  });
  it("never shows paid when the receiver reports it missing or owes money back", () => {
    expect(truthfulStatus({ ...base, status: "paid", money: "paid", notReceivedAt: t0 }).key).toBe("investigating");
    expect(truthfulStatus({ ...base, status: "paid", money: "owes_back" }).key).toBe("owes_back");
  });
  it("flags unclaimed PayPal payouts", () => {
    expect(truthfulStatus({ ...base, status: "in_batch", batch: { status: "submitted", createdAt: t0, sentAt: t0 }, itemStatuses: ["UNCLAIMED"] }).key).toBe("unclaimed");
  });
});

describe("timeline", () => {
  it("marks steps done in order", () => {
    const steps = claimTimeline({ ...base, status: "paid", money: "paid", approvedAt: t0, batch: { status: "completed", createdAt: t0, sentAt: t0 }, paidAt: t0 });
    expect(steps.map((s) => s.done)).toEqual([true, true, true, true, true, false]);
  });
});
