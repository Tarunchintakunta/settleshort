// Deterministic matcher: rules first, AI explains second (see ai.ts explainMatch).

export type MatchInput = {
  id: string;
  number?: number;
  vendor: string;
  amountCents: number;
  currency: string;
  txnDate: string | null;
  payerUserId: string;
};

export type MatchCandidate = { id: string; number?: number; score: number; reasons: string[] };

const STOP = new Set(["the", "inc", "llc", "co", "ltd", "store", "restaurant", "cafe", "&", "and"]);

export function normalizeMerchant(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .join(" ");
}

function merchantSimilarity(a: string, b: string) {
  const ta = new Set(normalizeMerchant(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeMerchant(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / Math.min(ta.size, tb.size);
}

function daysApart(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/** Score 0..1 that `b` is the same expense as `a`. */
export function scorePair(a: MatchInput, b: MatchInput): MatchCandidate {
  const reasons: string[] = [];
  if (a.currency !== b.currency) return { id: b.id, number: b.number, score: 0, reasons: ["different currency"] };

  let score = 0;
  const diff = Math.abs(a.amountCents - b.amountCents);
  const tol = Math.max(50, Math.round(a.amountCents * 0.01)); // ±1% or ±$0.50
  if (diff === 0) { score += 0.45; reasons.push("same amount"); }
  else if (diff <= tol) { score += 0.3; reasons.push("amount within tolerance"); }
  else return { id: b.id, number: b.number, score: 0, reasons: ["amount differs"] };

  const d = daysApart(a.txnDate, b.txnDate);
  if (d !== null && d <= 2) { score += 0.25; reasons.push(d === 0 ? "same date" : `dates ${Math.round(d)}d apart`); }
  else if (d !== null) score -= 0.2;

  const m = merchantSimilarity(a.vendor, b.vendor);
  if (m >= 0.99) { score += 0.25; reasons.push("same merchant"); }
  else if (m >= 0.5) { score += 0.15; reasons.push("similar merchant"); }

  if (a.payerUserId === b.payerUserId) { score += 0.05; reasons.push("same payer"); }

  return { id: b.id, number: b.number, score: Math.max(0, Math.min(1, Number(score.toFixed(2)))), reasons };
}

export const DUPLICATE_THRESHOLD = 0.8;

/** Two strong candidates too close to call: a human must pick, the system never guesses. */
export const isAmbiguous = (c: MatchCandidate[]) => c.length > 1 && c[1].score >= DUPLICATE_THRESHOLD - 0.2 && c[0].score - c[1].score < 0.1;

export function findMatches(claim: MatchInput, others: MatchInput[], min = 0.5): MatchCandidate[] {
  return others
    .filter((o) => o.id !== claim.id)
    .map((o) => scorePair(claim, o))
    .filter((c) => c.score >= min)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);
}
