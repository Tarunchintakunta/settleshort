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
    expect(o.payees).toEqual([{ userId: "sam", paidCents: 6400, owedCents: 6400, settledCents: 0, outstandingCents: 6400, payableNowCents: 6400 }]);
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

import { lineBreakdown, type Line } from "../src/lib/settlement";
describe("line items", () => {
  const l = (id: string, amountCents: number, extra: Partial<Line> = {}): Line => ({ id, name: id, amountCents, excluded: false, state: "pending", ...extra });
  it("spreads tax and tip over lines and excludes a personal item with its share (#18 #19)", () => {
    // $60 food + $20 wine, $8 tax, $12 tip = $100
    const b = lineBreakdown(10000, [l("food", 6000), l("wine", 2000, { excluded: true })], 800, 1200);
    expect(b.rows.map((r) => [r.id, r.extraCents])).toEqual([["food", 1500], ["wine", 500]]);
    expect(b.excludedCents).toBe(2500);
    expect(b.rows.reduce((a, r) => a + r.totalCents, 0)).toBe(10000);
  });
  it("adds an unitemized row so the total always adds up", () => {
    const b = lineBreakdown(10000, [l("a", 5000)], 0, 0);
    expect(b.rows.at(-1)).toMatchObject({ id: "unitemized", amountCents: 5000 });
  });
  it("holds disputed lines without erasing them (#22 #35)", () => {
    const b = lineBreakdown(10000, [l("ok", 7000, { state: "approved" }), l("taxi", 3000, { state: "disputed" })], 0, 0);
    expect(b.heldCents).toBe(3000);
    const o = computeObligations({ totalCents: 10000, payerUserId: "sam", heldCents: b.heldCents });
    expect(o.payees[0]).toMatchObject({ owedCents: 10000, outstandingCents: 10000, payableNowCents: 7000 });
  });
});

import { impliedRate } from "../src/lib/settlement";
describe("fx", () => {
  it("states the rate between receipt and charged amounts", () => {
    expect(impliedRate(250000, 3000)).toBe(0.012); // ₹2,500 charged as $30.00
    expect(impliedRate(0, 100)).toBeNull();
  });
});
