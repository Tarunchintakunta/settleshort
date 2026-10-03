// Pure parsing of a correction message ("Actually, Maya paid", "it was $72.40"). Unit-tested.
import { currencyFromSymbol, toCents } from "./money";

export type Correction = { payerUserId?: string; amountCents?: number; currency?: string; vendor?: string; txnDate?: string };

/**
 * Reads only what the person is correcting; everything else on the claim stays as it was.
 * Returns an empty object when nothing recognisable is being corrected, so nothing is guessed.
 */
export function parseCorrection(text: string, members: { id: string; name: string }[], today: string): Correction {
  const t = text.trim();
  const out: Correction = {};
  const first = (n: string) => n.split(/\s+/)[0].toLowerCase();
  const who = (word: string) => members.find((m) => first(m.name) === word.toLowerCase().replace(/^@/, "") || m.name.toLowerCase() === word.toLowerCase());

  // Try each phrasing; the first one naming a real member wins.
  const payerPatterns = [
    /\bpaid\s+by\s+(@?[A-Za-z]+)/i,
    /\bit\s+was\s+(@?[A-Za-z]+)\s+who\s+paid/i,
    /\b(@?[A-Za-z]+)\s+(?:actually\s+)?paid\b(?!\s+(?:for|at)\b)/i,
  ];
  for (const re of payerPatterns) {
    const m = t.match(re);
    const member = m && who(m[1]);
    if (member) {
      out.payerUserId = member.id;
      break;
    }
  }

  const amount = t.match(/(?:[$₹€£]|rs\.?\s?)\s?([\d,]+(?:\.\d{1,2})?)/i) ?? t.match(/\b(?:was|total(?:\s+was)?|is)\s+([\d,]+(?:\.\d{1,2})?)\b/i);
  if (amount) {
    const cents = toCents(amount[1]);
    if (cents) out.amountCents = cents;
    const cur = currencyFromSymbol(t);
    if (cur) out.currency = cur;
  }

  const vendor = t.match(/\b(?:it\s+was\s+)?at\s+([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*)*)/);
  if (vendor) out.vendor = vendor[1];

  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) out.txnDate = iso[1];
  else if (/\byesterday\b/i.test(t)) out.txnDate = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  return out;
}
