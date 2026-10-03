import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseReceiptText } from "../src/lib/ai-local";

describe("local receipt parser", () => {
  it("reads total, tax, tip, date and vendor from OCR text", () => {
    const x = parseReceiptText(`BLUE DOOR COFFEE
412 Valencia St
09/24/2026 08:42
Oat latte x2 $11.00
Almond croissant $4.00
Subtotal $15.00
Tax $1.40
Tip $2.00
TOTAL $18.40
VISA **** 4242`);
    expect(x.vendor).toBe("Blue Door Coffee");
    expect(x.amount_cents).toBe(1840);
    expect(x.tax_cents).toBe(140);
    expect(x.tip_cents).toBe(200);
    expect(x.txn_date).toBe("2026-09-24");
    expect(x.payment_last4).toBe("4242");
    expect(x.line_items.map((l) => l.amount_cents)).toEqual([1100, 400]);
    expect(x.confidence).toBeGreaterThan(0.55);
  });
  it("falls back to the largest amount with low confidence", () => {
    const x = parseReceiptText("corner store\n4.50\n12.00");
    expect(x.amount_cents).toBe(1200);
    expect(x.confidence).toBeLessThan(0.55);
  });
});

describe("field-level confidence", () => {
  it("scores a clearly labelled total high and a guessed total low", () => {
    const sure = parseReceiptText("BLUE DOOR COFFEE\n09/24/2026\nTOTAL $18.40", 95);
    const guess = parseReceiptText("BLUE DOOR COFFEE\nlatte $4.00\ncroissant $6.50", 95);
    expect(sure.field_confidence.amount).toBeGreaterThan(0.6);
    expect(guess.field_confidence.amount).toBeLessThan(0.6);
    expect(guess.field_confidence.date).toBeLessThan(0.6);
  });
});
