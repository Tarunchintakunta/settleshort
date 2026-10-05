import { formatMoney } from "./money";

/** People named after "split with" / "split between" ("Asha and Ravi"), as written. */
export function namesSplitWith(text: string) {
  return (text.match(/\bsplit\s+(?:it\s+)?(?:with|between)\s+([^.!?\n]+)/i)?.[1] ?? "")
    .split(/\s*(?:,|\band\b|&)\s*/i)
    .map((n) => n.replace(/^@/, "").trim())
    .filter((n) => /^[A-Z][\w'-]*(?:\s[A-Z][\w'-]*)?$/.test(n) && !/^(me|myself)$/i.test(n));
}

/** "for team lunch, split with…" -> "team lunch". Empty when the text names no purpose. */
export function whatFor(text: string) {
  return (
    text.match(/\bfor\s+(?:the\s+|a\s+|an\s+|our\s+)?([a-z][a-z'& -]{2,40}?)(?=\s*(?:[,.;!]|$|\s+(?:split|with|at|on|from|yesterday|today|last)\b))/i)?.[1]?.trim() ?? ""
  );
}

/** What to call a claim. The vendor when known; otherwise what it was for and the amount ("Team lunch, ₹1,200.00"), never "Untitled claim". */
export function claimTitle(c: { vendor: string; purpose?: string | null; note?: string | null; rawText?: string | null; amountCents: number; currency: string }) {
  if (c.vendor.trim()) return c.vendor.trim();
  const what = c.purpose?.trim() || whatFor(c.rawText ?? "") || whatFor(c.note ?? "");
  const money = formatMoney(c.amountCents, c.currency);
  return what ? `${what[0].toUpperCase()}${what.slice(1)}, ${money}` : `Claim for ${money}`;
}
