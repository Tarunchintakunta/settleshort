import { describe, expect, it } from "vitest";
import { overlappingSaas, personallyFundedSaas, type SaasClaim } from "../src/lib/saas";

const c = (id: string, payer: string, vendor: string, date: string, extra: Partial<SaasClaim> = {}): SaasClaim => ({
  id, payerUserId: payer, vendor, txnDate: date, category: null, amountCents: 1500, employeeFunded: true, status: "paid", ...extra,
});

describe("personally funded SaaS (#43)", () => {
  it("warns when someone pays for a tool themselves in two different months", () => {
    const w = personallyFundedSaas([c("1", "sam", "FIGMA INC", "2026-08-03"), c("2", "sam", "Figma", "2026-09-03"), c("3", "sam", "Chipotle", "2026-09-04")]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ payerUserId: "sam", tool: "figma", months: ["2026-08", "2026-09"], totalCents: 3000 });
  });
  it("ignores one-offs, company-card payments and rejected claims", () => {
    expect(personallyFundedSaas([c("1", "sam", "Figma", "2026-08-03")])).toEqual([]);
    expect(personallyFundedSaas([c("1", "sam", "Figma", "2026-08-03"), c("2", "sam", "Figma", "2026-09-03", { employeeFunded: false })])).toEqual([]);
    expect(personallyFundedSaas([c("1", "sam", "Figma", "2026-08-03"), c("2", "sam", "Figma", "2026-09-03", { status: "rejected" })])).toEqual([]);
  });
});

describe("overlapping software (#44)", () => {
  it("flags two people buying the same tool in the same month", () => {
    const o = overlappingSaas([c("1", "rita", "Notion", "2026-09-28"), c("2", "maya", "Notion Labs", "2026-09-02"), c("3", "dev", "Notion", "2026-08-02")]);
    expect(o).toEqual([{ tool: "notion", vendor: "Notion", month: "2026-09", payerUserIds: ["rita", "maya"], claimIds: ["1", "2"] }]);
  });
});
