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
