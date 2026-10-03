// Pure approver decision brief: everything needed to decide, in one view. Unit-tested.
import { formatMoney } from "./money";

export type BriefInput = {
  amountCents: number;
  currency: string;
  approvableCents: number;
  vendor: string;
  purpose: string;
  payer: string;
  evidenceKinds: string[];
  missing: string[];
  contradictions: string[];
  uncertainFields: string[];
  duplicateOf: number | null;
  maxSingleCents: number;
  receiptRequiredCents: number;
  /** This payer's previous approved claims at the same merchant, in cents. */
  merchantHistoryCents: number[];
  firstClaimByPayer: boolean;
  receiptCurrency: string | null;
};

export type Brief = { headline: string; gaps: string[]; unusual: string[]; evidence: string };

export function decisionBrief(b: BriefInput): Brief {
  const money = (c: number) => formatMoney(c, b.currency);
  const kinds = [...new Set(b.evidenceKinds)];
  const gaps = [...b.missing, ...b.contradictions, ...b.uncertainFields.map((f) => `AI unsure about the ${f}`)];
  if (b.duplicateOf) gaps.push(`Possible duplicate of #${b.duplicateOf}`);
  const unusual: string[] = [];
  if (b.amountCents > b.maxSingleCents) unusual.push(`Above the ${money(b.maxSingleCents)} single-payout cap`);
  if (kinds.includes("declaration")) unusual.push("No receipt: the payer signed a missing-receipt declaration");
  else if (b.amountCents >= b.receiptRequiredCents && !kinds.some((k) => ["receipt", "invoice", "statement"].includes(k))) unusual.push("Only a chat message as proof");
  if (b.receiptCurrency && b.receiptCurrency !== b.currency) unusual.push(`Receipt in ${b.receiptCurrency}, reimbursed in ${b.currency}`);
  if (b.firstClaimByPayer) unusual.push(`First claim reimbursing ${b.payer}`);
  const avg = b.merchantHistoryCents.length ? b.merchantHistoryCents.reduce((a, c) => a + c, 0) / b.merchantHistoryCents.length : null;
  if (avg && b.amountCents > avg * 2) unusual.push(`More than twice ${b.payer}'s usual ${money(Math.round(avg))} at ${b.vendor || "this merchant"}`);
  return {
    headline: `${money(b.approvableCents)} to ${b.payer}${b.approvableCents !== b.amountCents ? ` (of ${money(b.amountCents)} claimed)` : ""} for ${b.purpose.trim() || "an unstated purpose"}`,
    gaps,
    unusual,
    evidence: kinds.length ? kinds.join(", ") : "none",
  };
}
