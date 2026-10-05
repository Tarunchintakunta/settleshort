import { describe, expect, it } from "vitest";
import { claimTitle, whatFor } from "@/lib/title";
import { parseTextLocal } from "@/lib/ai-local";
import { realVendor } from "@/lib/ai";

describe("claim titles and attendees", () => {
  it("titles a vendorless claim from what it was for", () => {
    const text = "I paid 1200 INR for team lunch, split with Asha and Ravi";
    expect(whatFor(text)).toBe("team lunch");
    expect(claimTitle({ vendor: "", rawText: text, amountCents: 120000, currency: "INR" })).toBe("Team lunch, ₹1,200.00");
    expect(claimTitle({ vendor: "Truffles", amountCents: 1, currency: "INR" })).toBe("Truffles");
    expect(claimTitle({ vendor: "", amountCents: 500, currency: "USD" })).toBe("Claim for $5.00");
  });

  it("keeps people named with 'split with' even when they aren't members", () => {
    const p = parseTextLocal("I paid 1200 INR for team lunch, split with Asha and Ravi", [{ id: "1", name: "Ravi Kumar", handle: "ravi" }], "2026-10-05");
    expect(p.payee_names).toEqual(["Asha", "Ravi Kumar"]);
    expect(p.includes_payer).toBe(true);
    expect(p.amount_cents).toBe(120000);
    expect(p.currency).toBe("INR");
  });

  it("never stores a placeholder vendor", () => {
    expect(realVendor("Unknown vendor")).toBe("");
    expect(realVendor("N/A")).toBe("");
    expect(realVendor(" Uber ")).toBe("Uber");
    expect(realVendor("Unique Cafe")).toBe("Unique Cafe");
  });
});
