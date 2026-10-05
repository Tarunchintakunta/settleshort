import { describe, expect, it } from "vitest";
import { ReceiptExtract, TextClaim } from "../src/lib/ai";

describe("receipt extraction parsing", () => {
  it("accepts a well-formed model answer and fills defaults", () => {
    const x = ReceiptExtract.parse({ vendor: "Nopa", amount_cents: 18650, currency: "usd", txn_date: "2026-09-26", confidence: 0.9 });
    expect(x.currency).toBe("USD");
    expect(x.tax_cents).toBe(0);
    expect(x.line_items).toEqual([]);
    expect(x.field_confidence).toEqual({});
  });
  it("rejects floats, negative amounts, bad dates and out-of-range confidence", () => {
    const ok = { vendor: "A", amount_cents: 100, currency: "USD", txn_date: null, confidence: 0.5 };
    expect(() => ReceiptExtract.parse({ ...ok, amount_cents: 12.5 })).toThrow();
    expect(() => ReceiptExtract.parse({ ...ok, amount_cents: -1 })).toThrow();
    expect(() => ReceiptExtract.parse({ ...ok, txn_date: "26/09/2026" })).toThrow();
    expect(() => ReceiptExtract.parse({ ...ok, confidence: 1.4 })).toThrow();
    expect(() => ReceiptExtract.parse({ ...ok, currency: "DOLLARS" })).toThrow();
  });
  it("parses a split message without inventing payment details", () => {
    const t = TextClaim.parse({ amount_cents: 240000, currency: "INR", vendor: "team dinner", payee_names: ["Asha", "Ravi"], payer_name: null, includes_payer: true, confidence: 0.8 });
    expect(t.payee_names).toEqual(["Asha", "Ravi"]);
    expect(Object.keys(t)).not.toContain("paypal_email");
  });
});
