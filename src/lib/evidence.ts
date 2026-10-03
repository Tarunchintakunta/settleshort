import { normalizeMerchant } from "./matching";
import { formatMoney } from "./money";

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


export type EvidenceFacts = {
  id: string;
  kind: string;
  extract: { vendor?: string | null; amount_cents?: number; currency?: string; txn_date?: string | null; field_confidence?: FieldConfidence } | null;
};
export type ClaimFields = { amountCents: number; currency: string; txnDate: string | null; vendor: string };
export type Contradiction = { key: string; field: "amount" | "date" | "vendor"; message: string };

const KIND_LABEL: Record<string, string> = { receipt: "the receipt", invoice: "the invoice", message: "the message", statement: "the statement", declaration: "the declaration" };
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const sameMerchant = (a: string, b: string) => {
  const [x, y] = [normalizeMerchant(a), normalizeMerchant(b)];
  return !x || !y || x.includes(y) || y.includes(x) || x.split(" ")[0] === y.split(" ")[0];
};

/**
 * Where two pieces of evidence disagree with each other ("the message says ₹2,000 but the receipt says ₹2,500").
 * The key is stable for the same disagreement, so a human can acknowledge it once. Fields the extractor
 * only guessed (low field confidence) never count as a contradiction. Pass evidence oldest first.
 */
export function findContradictions(evidence: EvidenceFacts[]): Contradiction[] {
  const out: Contradiction[] = [];
  const seen = new Set<string>();
  const ev = evidence.filter((e) => e.extract);
  for (let i = 0; i < ev.length; i++)
    for (let j = i + 1; j < ev.length; j++) {
      const [a, b] = [ev[i], ev[j]];
      const [x, y] = [a.extract!, b.extract!];
      const sure = (f: string) => (x.field_confidence?.[f] ?? 1) >= FIELD_UNSURE && (y.field_confidence?.[f] ?? 1) >= FIELD_UNSURE;
      const la = a.kind === b.kind ? `the original ${a.kind}` : (KIND_LABEL[a.kind] ?? a.kind);
      const lb = a.kind === b.kind ? `the added ${b.kind}` : (KIND_LABEL[b.kind] ?? b.kind);
      const push = (field: Contradiction["field"], va: string, vb: string, message: string) => {
        const key = `${field}:${[va, vb].sort().join("|")}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ key, field, message });
      };
      if (sure("amount") && x.amount_cents && y.amount_cents && (x.amount_cents !== y.amount_cents || (x.currency && y.currency && x.currency !== y.currency)))
        push(
          "amount",
          `${x.amount_cents}${x.currency}`,
          `${y.amount_cents}${y.currency}`,
          `${cap(la)} says ${formatMoney(x.amount_cents, x.currency ?? "USD")} but ${lb} says ${formatMoney(y.amount_cents, y.currency ?? "USD")}`,
        );
      if (sure("date") && x.txn_date && y.txn_date && days(x.txn_date, y.txn_date) > 1) push("date", x.txn_date, y.txn_date, `${cap(la)} is dated ${x.txn_date} but ${lb} is dated ${y.txn_date}`);
      if (sure("vendor") && x.vendor && y.vendor && !sameMerchant(x.vendor, y.vendor)) push("vendor", x.vendor, y.vendor, `${cap(la)} names ${x.vendor} but ${lb} names ${y.vendor}`);
    }
  return out;
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export type MissingQuestion = { field: "amount" | "vendor" | "txnDate" | "purpose" | "receipt"; question: string; placeholder: string };

/**
 * What a claim still needs before anyone can approve it, as one plain question per gap. Only real gaps
 * are asked: a clear amount is never asked again just because the purpose is missing.
 */
export function missingQuestions(
  c: { amountCents: number; vendor: string; txnDate: string | null; purpose: string },
  proof?: { kinds: string[]; receiptRequiredCents: number },
): MissingQuestion[] {
  const out: MissingQuestion[] = [];
  if (!c.amountCents) out.push({ field: "amount", question: "How much was it?", placeholder: "42.30" });
  if (!c.vendor.trim()) out.push({ field: "vendor", question: "Where did you buy it?", placeholder: "Uber, Chipotle, Figma…" });
  if (!c.txnDate) out.push({ field: "txnDate", question: "What day was it?", placeholder: "YYYY-MM-DD" });
  if (!c.purpose.trim()) out.push({ field: "purpose", question: "What was it for? (the business reason)", placeholder: "Client lunch with Acme, onboarding offsite…" });
  // Receipt policy: a message alone isn't proof above the threshold. A declaration is an honest alternative.
  if (proof && c.amountCents >= proof.receiptRequiredCents && !proof.kinds.some((k) => ["receipt", "invoice", "statement", "declaration"].includes(k)))
    out.push({ field: "receipt", question: "Attach the receipt, or declare it missing", placeholder: "" });
  return out;
}

/**
 * Content fingerprint for one piece of evidence: the same purchase gives the same key whether it arrived as
 * a forwarded PDF or a phone photo. Null when the extract is too thin to identify a purchase.
 */
export function contentKey(x: { vendor?: string | null; amount_cents?: number; currency?: string; txn_date?: string | null; field_confidence?: FieldConfidence } | null | undefined) {
  if (!x?.amount_cents || !x.txn_date || !x.vendor) return null;
  // A guessed field (e.g. a date defaulted to today) would make unrelated purchases look identical.
  if (["vendor", "amount", "date"].some((f) => (x.field_confidence?.[f] ?? 1) < FIELD_UNSURE)) return null;
  const merchant = normalizeMerchant(x.vendor).split(" ")[0];
  return merchant ? `${merchant}|${x.amount_cents}|${x.currency ?? ""}|${x.txn_date}` : null;
}

export type Context = { id: string; kind: "customer_meeting" | "project" | "event"; name: string; startsOn: string | null; endsOn: string | null };
const CONTEXT_LABEL: Record<Context["kind"], string> = { customer_meeting: "Customer meeting", project: "Project", event: "Event" };
export const contextPurpose = (c: Context) => `${CONTEXT_LABEL[c.kind]}: ${c.name}`;

/**
 * Purposes a person can pick, taken only from approved context around the expense date: a meeting or event
 * within a day, or a project running that day. Never generated text, never a guess without a date.
 */
export function suggestPurposes(txnDate: string | null, all: Context[]): { id: string; purpose: string }[] {
  if (!txnDate) return [];
  const t = Date.parse(txnDate);
  const near = (d: string | null) => d != null && Math.abs(Date.parse(d) - t) <= 86_400_000;
  return all
    .filter((c) => (c.kind === "project" ? c.startsOn != null && Date.parse(c.startsOn) <= t && (c.endsOn == null || Date.parse(c.endsOn) >= t) : near(c.startsOn)))
    .sort((a, b) => (a.kind === "project" ? 1 : 0) - (b.kind === "project" ? 1 : 0))
    .slice(0, 4)
    .map((c) => ({ id: c.id, purpose: contextPurpose(c) }));
}
