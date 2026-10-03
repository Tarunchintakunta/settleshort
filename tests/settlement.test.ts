import { describe, expect, it } from "vitest";
import { allocate, computeObligations, moneyStatus, paymentsProblem } from "../src/lib/settlement";

describe("allocate", () => {
  it("never loses a cent", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
    expect(allocate(999, [2, 1]).reduce((a, b) => a + b)).toBe(999);
  });
});

describe("obligations", () => {
  it("defaults to the single payer for the whole amount", () => {
    const o = computeObligations({ totalCents: 6400, payerUserId: "sam" });
    expect(o.payees).toEqual([{ userId: "sam", paidCents: 6400, owedCents: 6400, settledCents: 0, outstandingCents: 6400 }]);
    expect(moneyStatus(o)).toBe("unpaid");
  });

  it("reimburses two payers for what each put down (#12)", () => {
    const o = computeObligations({
      totalCents: 30000,
      payerUserId: "sam",
      payments: [
        { userId: "sam", source: "employee", amountCents: 10000 },
        { userId: "rita", source: "employee", amountCents: 20000 },
      ],
    });
    expect(o.payees.map((p) => [p.userId, p.owedCents])).toEqual([["sam", 10000], ["rita", 20000]]);
  });

  it("reimburses only the employee-funded part (#13)", () => {
    const o = computeObligations({
      totalCents: 25000,
      payerUserId: "sam",
      payments: [
        { userId: null, source: "company_card", amountCents: 20000 },
        { userId: "sam", source: "employee", amountCents: 5000 },
      ],
    });
    expect(o.companyFundedCents).toBe(20000);
    expect(o.reimbursableCents).toBe(5000);
    expect(o.outstandingCents).toBe(5000);
  });

  it("keeps a remaining balance after a partial repayment (#14)", () => {
    const o = computeObligations({ totalCents: 10000, payerUserId: "sam", ledger: [{ userId: "sam", kind: "repayment", amountCents: 4000 }] });
    expect(o.outstandingCents).toBe(6000);
    expect(moneyStatus(o)).toBe("partially_paid");
  });

  it("turns a refund after reimbursement into money owed back (#15)", () => {
    const o = computeObligations({
      totalCents: 10000,
      payerUserId: "sam",
      ledger: [
        { userId: "sam", kind: "payout", amountCents: 10000 },
        { userId: "sam", kind: "refund", amountCents: 2500 },
      ],
    });
    expect(o.owedBackCents).toBe(2500);
    expect(moneyStatus(o)).toBe("owes_back");
    const settled = computeObligations({
      totalCents: 10000,
      payerUserId: "sam",
      ledger: [
        { userId: "sam", kind: "payout", amountCents: 10000 },
        { userId: "sam", kind: "refund", amountCents: 2500 },
        { userId: "sam", kind: "clawback", amountCents: 2500 },
      ],
    });
    expect(moneyStatus(settled)).toBe("paid");
  });

  it("a bounced payout is owed again", () => {
    const o = computeObligations({
      totalCents: 5000,
      payerUserId: "sam",
      ledger: [
        { userId: "sam", kind: "payout", amountCents: 5000 },
        { userId: "sam", kind: "payout_reversal", amountCents: 5000 },
      ],
    });
    expect(o.outstandingCents).toBe(5000);
  });

  it("excluded personal items come out of the employee share", () => {
    const o = computeObligations({ totalCents: 10000, payerUserId: "sam", excludedCents: 1800 });
    expect(o.reimbursableCents).toBe(8200);
  });

  it("validates payment rows", () => {
    expect(paymentsProblem(100, [{ userId: "a", source: "employee", amountCents: 60 }])).toMatch(/add up/);
    expect(paymentsProblem(100, [{ userId: null, source: "employee", amountCents: 100 }])).toMatch(/person/);
    expect(paymentsProblem(100, [{ userId: null, source: "company_card", amountCents: 100 }])).toBeNull();
  });
});
