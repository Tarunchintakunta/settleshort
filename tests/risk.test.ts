import { describe, expect, it } from "vitest";
import { hasHighRisk, riskSignals, type RiskClaim } from "../src/lib/risk";

const c = (id: string, n: number, vendor: string, cents: number, date: string, extra: Partial<RiskClaim> = {}): RiskClaim => ({
  id, number: n, vendor, amountCents: cents, currency: "INR", txnDate: date, status: "pending_review", ...extra,
});

describe("soft fraud signals", () => {
  it("flags exact twins on both sides and links each other", () => {
    const a = c("a", 1, "Truffles Cafe", 240000, "2026-10-05");
    const b = c("b", 2, "truffles, cafe!", 240000, "2026-10-05");
    const ws = [a, b];
    expect(riskSignals(a, ws)).toEqual([expect.objectContaining({ id: "DUP_EXACT", severity: "high", related: [{ id: "b", number: 2 }] })]);
    expect(riskSignals(b, ws)[0]).toMatchObject({ id: "DUP_EXACT", related: [{ id: "a", number: 1 }] });
    expect(hasHighRisk(riskSignals(a, ws))).toBe(true);
  });

  it("flags near amounts the same day within 2% or the ₹50 floor", () => {
    const a = c("a", 1, "Uber", 30000, "2026-10-05");
    expect(riskSignals(a, [a, c("b", 2, "Uber", 34000, "2026-10-05")])[0]).toMatchObject({ id: "DUP_NEAR_AMOUNT", severity: "medium" });
    expect(riskSignals(a, [a, c("b", 2, "Uber", 36000, "2026-10-05")])).toEqual([]);
  });

  it("flags 3+ claims at a vendor within a week as low", () => {
    const a = c("a", 1, "Swiggy", 1000, "2026-10-01");
    const s = riskSignals(a, [a, c("b", 2, "Swiggy", 2000, "2026-10-03"), c("d", 3, "Swiggy", 3000, "2026-10-06")]);
    expect(s).toEqual([expect.objectContaining({ id: "DUP_VENDOR_WEEK", severity: "low" })]);
  });

  it("ignores empty or unknown vendors, rejected targets and dismissed pairs", () => {
    const blank = c("a", 1, "", 500, "2026-10-05");
    expect(riskSignals(blank, [blank, c("b", 2, "", 500, "2026-10-05")])).toEqual([]);
    const unk = c("a", 1, "Unknown vendor", 500, "2026-10-05");
    expect(riskSignals(unk, [unk, c("b", 2, "Unknown vendor", 500, "2026-10-05")])).toEqual([]);
    const a = c("a", 1, "Zomato", 500, "2026-10-05");
    expect(riskSignals(a, [a, c("b", 2, "Zomato", 500, "2026-10-05", { status: "rejected" })])).toEqual([]);
    expect(riskSignals(a, [a, c("b", 2, "Zomato", 500, "2026-10-05", { dismissed: ["a"] })])).toEqual([]);
  });

  it("uses the receipt's calendar date, so different days never match", () => {
    const a = c("a", 1, "Zomato", 500, "2026-10-05");
    expect(riskSignals(a, [a, c("b", 2, "Zomato", 500, "2026-10-06")]).map((s) => s.id)).not.toContain("DUP_EXACT");
  });
});
