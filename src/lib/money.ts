const SYMBOLS: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£" };

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** "12.5" | "12.50" | "1,200" -> integer cents. Returns null if not a number. */
export function toCents(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
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
