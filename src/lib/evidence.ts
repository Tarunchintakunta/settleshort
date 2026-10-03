// Pure evidence logic: per-field certainty, contradictions, missing information. No DB access; unit-tested.

export const FIELD_UNSURE = 0.6;
export const FIELD_LABEL: Record<string, string> = {
  vendor: "Merchant",
  amount: "Amount",
  date: "Date",
  currency: "Currency",
  tax: "Tax",
  tip: "Tip",
  payer: "Who paid",
  payees: "Who it was for",
};

export type FieldConfidence = Record<string, number>;

/** Fields the extractor wasn't sure about. These must never look as confident as the rest. */
export function uncertainFields(fc: FieldConfidence | null | undefined, threshold = FIELD_UNSURE): string[] {
  return Object.entries(fc ?? {})
    .filter(([, v]) => typeof v === "number" && v < threshold)
    .map(([k]) => k);
}
