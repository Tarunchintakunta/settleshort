import { describe, expect, it } from "vitest";
import { decisionBrief, type BriefInput } from "../src/lib/brief";

const base: BriefInput = {
  amountCents: 6400,
  currency: "USD",
  approvableCents: 6400,
  vendor: "Chipotle",
  purpose: "Team lunch",
  payer: "Sam Patel",
  evidenceKinds: ["receipt"],
  missing: [],
  contradictions: [],
  uncertainFields: [],
  duplicateOf: null,
  maxSingleCents: 50000,
  receiptRequiredCents: 2500,
  merchantHistoryCents: [6000, 7000],
  firstClaimByPayer: false,
  receiptCurrency: "USD",
};

describe("decision brief", () => {
  it("is quiet for a routine claim", () => {
    const b = decisionBrief(base);
    expect(b.headline).toBe("$64.00 to Sam Patel for Team lunch");
    expect(b.gaps).toEqual([]);
    expect(b.unusual).toEqual([]);
  });
  it("surfaces gaps and unusual details", () => {
    const b = decisionBrief({ ...base, amountCents: 60000, approvableCents: 50000, evidenceKinds: ["message"], uncertainFields: ["date"], duplicateOf: 6, firstClaimByPayer: true });
    expect(b.headline).toBe("$500.00 to Sam Patel (of $600.00 claimed) for Team lunch");
    expect(b.gaps).toEqual(["AI unsure about the date", "Possible duplicate of #6"]);
    expect(b.unusual).toEqual([
      "Above the $500.00 single-payout cap",
      "Only a chat message as proof",
      "First claim reimbursing Sam Patel",
      "More than twice Sam Patel's usual $65.00 at Chipotle",
    ]);
  });
});
