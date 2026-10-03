import { describe, expect, it } from "vitest";
import { findMatches, DUPLICATE_THRESHOLD, normalizeMerchant } from "../src/lib/matching";
import { splitEven, toCents, currencyFromSymbol } from "../src/lib/money";

const base = { id: "a", vendor: "Chipotle Mexican Grill", amountCents: 6400, currency: "USD", txnDate: "2026-09-20", payerUserId: "u1" };

describe("money", () => {
  it("parses to cents", () => {
    expect(toCents("84.50")).toBe(8450);
    expect(toCents("1,200")).toBe(120000);
    expect(toCents("abc")).toBeNull();
    expect(toCents(-1)).toBeNull();
  });
  it("splits without losing cents", () => {
    expect(splitEven(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEven(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
  it("detects currency", () => {
    expect(currencyFromSymbol("I paid ₹1200")).toBe("INR");
    expect(currencyFromSymbol("$42.30 uber")).toBe("USD");
  });
});

describe("matching", () => {
  it("flags an exact duplicate", () => {
    const [m] = findMatches(base, [{ ...base, id: "b", vendor: "CHIPOTLE", txnDate: "2026-09-21" }]);
    expect(m.score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });
  it("ignores different amounts and currencies", () => {
    expect(findMatches(base, [{ ...base, id: "b", amountCents: 9000 }])).toEqual([]);
    expect(findMatches(base, [{ ...base, id: "c", currency: "INR" }])).toEqual([]);
  });
  it("normalizes merchants", () => {
    expect(normalizeMerchant("The Coffee Shop, Inc.")).toBe("coffee shop");
  });
});

import { uncertainFields } from "../src/lib/evidence";
describe("uncertain fields", () => {
  it("lists only fields under the threshold", () => {
    expect(uncertainFields({ vendor: 0.9, amount: 0.3, date: 0.59 })).toEqual(["amount", "date"]);
    expect(uncertainFields(null)).toEqual([]);
  });
});

import { findContradictions } from "../src/lib/evidence";
describe("contradictions", () => {
  const msg = { id: "m", kind: "message", extract: { vendor: "Truffles", amount_cents: 200000, currency: "INR", txn_date: "2026-09-20" } };
  const rcpt = { id: "r", kind: "receipt", extract: { vendor: "Truffles Cafe", amount_cents: 250000, currency: "INR", txn_date: "2026-09-20" } };
  it("flags a message and receipt that disagree on the amount", () => {
    const [c] = findContradictions([msg, rcpt]);
    expect(c.field).toBe("amount");
    expect(c.message).toBe("The message says ₹2,000.00 but the receipt says ₹2,500.00");
  });
  it("is quiet when evidence agrees", () => {
    expect(findContradictions([msg, { ...rcpt, extract: { ...rcpt.extract, amount_cents: 200000 } }])).toEqual([]);
  });
  it("flags different merchants and far-apart dates", () => {
    const other = { id: "o", kind: "invoice", extract: { vendor: "Starbucks", amount_cents: 200000, currency: "INR", txn_date: "2026-09-25" } };
    expect(findContradictions([msg, other]).map((c) => c.field).sort()).toEqual(["date", "vendor"]);
  });
});

describe("contradictions ignore guesses", () => {
  it("doesn't flag a date the parser only defaulted", () => {
    const a = { id: "a", kind: "message", extract: { amount_cents: 6400, currency: "USD", txn_date: "2026-09-29", field_confidence: { date: 0.85 } } };
    const b = { id: "b", kind: "message", extract: { amount_cents: 6400, currency: "USD", txn_date: "2026-10-03", field_confidence: { date: 0.5 } } };
    expect(findContradictions([a, b])).toEqual([]);
  });
  it("names original and added evidence of the same kind", () => {
    const a = { id: "a", kind: "message", extract: { amount_cents: 6400, currency: "USD" } };
    const b = { id: "b", kind: "message", extract: { amount_cents: 7240, currency: "USD" } };
    expect(findContradictions([a, b])[0].message).toBe("The original message says $64.00 but the added message says $72.40");
  });
});

import { missingQuestions } from "../src/lib/evidence";
describe("missing questions", () => {
  it("asks only for what is missing", () => {
    const q = missingQuestions({ amountCents: 4230, vendor: "Uber", txnDate: "2026-09-25", purpose: "" });
    expect(q.map((x) => x.field)).toEqual(["purpose"]);
    expect(missingQuestions({ amountCents: 0, vendor: "", txnDate: null, purpose: "x" }).map((x) => x.field)).toEqual(["amount", "vendor", "txnDate"]);
  });
});

import { isAmbiguous } from "../src/lib/matching";
describe("ambiguous matches", () => {
  it("needs a human when two strong candidates are close", () => {
    expect(isAmbiguous([{ id: "a", score: 0.95, reasons: [] }, { id: "b", score: 0.9, reasons: [] }])).toBe(true);
    expect(isAmbiguous([{ id: "a", score: 0.95, reasons: [] }, { id: "b", score: 0.5, reasons: [] }])).toBe(false);
    expect(isAmbiguous([{ id: "a", score: 0.95, reasons: [] }])).toBe(false);
  });
});
