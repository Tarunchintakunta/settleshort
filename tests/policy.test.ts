import { describe, expect, it } from "vitest";
import { approvalBlocker, diffSnapshots, hashSnapshot, type Snapshot } from "../src/lib/policy";

const snap: Snapshot = { amountCents: 6400, currency: "USD", payees: [{ userId: "sam", amountCents: 6400 }], evidenceIds: ["e1"] };

describe("approval snapshot", () => {
  it("is stable under reordering", () => {
    const a = { ...snap, evidenceIds: ["e2", "e1"] };
    const b = { ...snap, evidenceIds: ["e1", "e2"] };
    expect(hashSnapshot(a)).toBe(hashSnapshot(b));
  });
  it("changes when amount, recipient or evidence changes", () => {
    expect(hashSnapshot({ ...snap, amountCents: 7000 })).not.toBe(hashSnapshot(snap));
    expect(hashSnapshot({ ...snap, payees: [{ userId: "dev", amountCents: 6400 }] })).not.toBe(hashSnapshot(snap));
    expect(hashSnapshot({ ...snap, evidenceIds: ["e1", "e2"] })).not.toBe(hashSnapshot(snap));
  });
  it("explains what changed", () => {
    const after = { ...snap, amountCents: 7000, payees: [{ userId: "dev", amountCents: 7000 }], evidenceIds: ["e1", "e2"] };
    expect(diffSnapshots(snap, after)).toEqual([
      "Amount changed from $64.00 to $70.00",
      "New recipient dev ($70.00)",
      "sam removed as a recipient",
      "1 piece of evidence added",
    ]);
    expect(diffSnapshots(snap, snap)).toEqual([]);
  });
});

describe("maker-checker", () => {
  const claim = { submitterId: "sam", payeeIds: ["sam"] };
  it("blocks approving your own claim", () => {
    expect(approvalBlocker({ id: "sam", role: "admin" }, claim, null)?.code).toBe("self_approval");
    expect(approvalBlocker({ id: "maya", role: "owner" }, { submitterId: "dev", payeeIds: ["maya"] }, null)?.code).toBe("self_approval");
  });
  it("lets another admin or the alternate approver approve", () => {
    expect(approvalBlocker({ id: "maya", role: "owner" }, claim, null)).toBeNull();
    expect(approvalBlocker({ id: "rita", role: "member" }, { submitterId: "maya", payeeIds: ["maya"] }, "rita")).toBeNull();
  });
  it("blocks plain members", () => {
    expect(approvalBlocker({ id: "rita", role: "member" }, claim, null)?.code).toBe("forbidden");
  });
});

import { activeDelegations, approvalOutcome } from "../src/lib/policy";
describe("approval limits (#26)", () => {
  it("needs someone whose limit covers the amount", () => {
    expect(approvalOutcome(80000, [{ approverId: "lead", coversCents: 50000 }], null)).toEqual({ approved: false, needed: "an approver whose limit covers this amount" });
    expect(approvalOutcome(80000, [{ approverId: "lead", coversCents: 50000 }, { approverId: "cfo", coversCents: null }], null)).toEqual({ approved: true });
  });
  it("needs two different people above the second-approval threshold", () => {
    expect(approvalOutcome(30000, [{ approverId: "cfo", coversCents: null }], 20000).approved).toBe(false);
    expect(approvalOutcome(30000, [{ approverId: "cfo", coversCents: null }, { approverId: "cfo", coversCents: null }], 20000).approved).toBe(false);
    expect(approvalOutcome(30000, [{ approverId: "cfo", coversCents: null }, { approverId: "lead", coversCents: 10000 }], 20000).approved).toBe(true);
    expect(approvalOutcome(10000, [{ approverId: "cfo", coversCents: null }], 20000).approved).toBe(true);
  });
});

describe("delegation (#27)", () => {
  const d = { fromUserId: "maya", toUserId: "rita", startsAt: new Date("2026-10-01"), endsAt: new Date("2026-10-08") };
  it("counts only while active", () => {
    expect(activeDelegations("rita", [d], new Date("2026-10-03"))).toHaveLength(1);
    expect(activeDelegations("rita", [d], new Date("2026-10-09"))).toHaveLength(0);
    expect(activeDelegations("sam", [d], new Date("2026-10-03"))).toHaveLength(0);
  });
});
