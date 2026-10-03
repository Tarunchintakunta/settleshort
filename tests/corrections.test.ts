import { describe, expect, it } from "vitest";
import { parseCorrection } from "../src/lib/corrections";

const members = [
  { id: "maya", name: "Maya Chen" },
  { id: "sam", name: "Sam Patel" },
];

describe("corrections", () => {
  it("changes only the payer", () => {
    expect(parseCorrection("Actually, Maya paid", members, "2026-10-03")).toEqual({ payerUserId: "maya" });
    expect(parseCorrection("it was paid by @sam", members, "2026-10-03")).toEqual({ payerUserId: "sam" });
  });
  it("changes only the amount", () => {
    expect(parseCorrection("sorry, it was $72.40", members, "2026-10-03")).toEqual({ amountCents: 7240, currency: "USD" });
    expect(parseCorrection("total was ₹2,500", members, "2026-10-03")).toEqual({ amountCents: 250000, currency: "INR" });
  });
  it("reads merchant and date fixes", () => {
    expect(parseCorrection("it was at Blue Bottle yesterday", members, "2026-10-03")).toEqual({ vendor: "Blue Bottle", txnDate: "2026-10-02" });
  });
  it("guesses nothing from unrelated text", () => {
    expect(parseCorrection("thanks!", members, "2026-10-03")).toEqual({});
    expect(parseCorrection("Bob paid", members, "2026-10-03")).toEqual({});
  });
});
