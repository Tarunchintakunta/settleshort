const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£" };

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** "12.5" | "12.50" | "1,200" -> integer cents. Returns null if not a number. */
export function toCents(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  // Half-up on the decimal string: 10.005 -> 1001, where Math.round(10.005 * 100) gives 1000.
  return Math.round(Number((n * 100).toFixed(3)));
}

/** Max a single claim can be worth, in cents (also the API's PATCH ceiling). */
export const MAX_CLAIM_CENTS = 100_000_000;

/**
 * Why a message's amount can't become a claim, in the words the person should read, or null when it can.
 * Catches what a parser quietly turns into 0 or a positive number: "-$50", "$0", "$999,999,999".
 */
export function amountProblem(text: string, cents: number, currency = "USD"): string | null {
  if (/(?:^|[\s(])-\s?[$₹€£]?\s?\d|[$₹€£]\s?-\s?\d|\bminus\s+[$₹€£]?\d/i.test(text)) return "Amount must be positive. Record a refund on the original claim instead.";
  const explicitZero = /[$₹€£]\s?0+(?:\.0+)?(?![\d.,]\d)/.test(text) || /(?:^|\s)0+(?:\.0+)?\s?(?:usd|inr|eur|gbp|dollars|bucks|rupees|rs)\b/i.test(text);
  if (!cents && explicitZero) return `Amount must be more than ${formatMoney(0, currency)}.`;
  if (cents > MAX_CLAIM_CENTS) return `Amount is above ${formatMoney(MAX_CLAIM_CENTS, currency)}. Check the number.`;
  return null;
}

/** PayPal wants "12.50" strings. */
export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

export function currencyFromSymbol(text: string): string | null {
  if (/₹|\brs\.?|\binr\b|rupee/i.test(text)) return "INR";
  if (/€|\beur\b/i.test(text)) return "EUR";
  if (/£|\bgbp\b/i.test(text)) return "GBP";
  if (/\$|\busd\b|dollar/i.test(text)) return "USD";
  return null;
}

export const currencySymbol = (c: string) => SYMBOLS[c] ?? c;

/** Even split that never loses a cent: remainder goes to the first shares. */
export function splitEven(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  const rem = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
