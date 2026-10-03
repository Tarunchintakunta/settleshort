import "server-only";
import os from "node:os";
import { currencyFromSymbol, toCents } from "./money";
import type { AiMember, ReceiptExtract, TextClaim } from "./ai";

// Keyless AI path: Tesseract OCR (WASM) reads the receipt, then a deterministic parser
// structures it. Real extraction, no API key; slower and less robust than a vision model.

const MONEY = /(?:[$₹€£]|rs\.?\s?)?\s?(\d{1,3}(?:[,]\d{3})*(?:\.\d{2})|\d+\.\d{2})\b/gi;
const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

function moneyIn(line: string): number[] {
  return [...line.matchAll(MONEY)].map((m) => toCents(m[1])).filter((n): n is number => n !== null);
}

function findDate(text: string): { iso: string; line: string } | null {
  for (const line of text.split("\n")) {
    let m = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return { iso: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, line };
    m = line.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/);
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      // US-style month first unless the first number can't be a month.
      const [mo, d] = Number(m[1]) > 12 ? [m[2], m[1]] : [m[1], m[2]];
      return { iso: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, line };
    }
    m = line.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(20\d{2})\b/i) ?? null;
    if (m && MONTHS.includes(m[2].toLowerCase())) return { iso: `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, line };
    m = line.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
    if (m && MONTHS.includes(m[1].toLowerCase())) return { iso: `${m[3]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`, line };
  }
  return null;
}

/** Turns raw receipt text (OCR or PDF) into a structured extract. Exported for tests. */
export function parseReceiptText(text: string, ocrConfidence = 90): ReceiptExtract {
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const evidence: Record<string, string> = {};

  const vendorLine = lines.find((l) => /[a-z]{3}/i.test(l) && !/receipt|invoice|order|welcome|thank|\d{3,}/i.test(l) && moneyIn(l).length === 0);
  const vendor = vendorLine ? vendorLine.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) : "";
  if (vendorLine) evidence.vendor = vendorLine;

  const pick = (re: RegExp, exclude?: RegExp) => {
    const hits = lines.filter((l) => re.test(l) && !(exclude && exclude.test(l)) && moneyIn(l).length);
    const line = hits.at(-1);
    return line ? { cents: moneyIn(line).at(-1)!, line } : null;
  };
  const totalHit = pick(/\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total|amount paid)\b/i, /sub\s*-?\s*total|total\s*tax|tax\s*total/i);
  const taxHit = pick(/\b(tax|gst|vat|hst|cgst|sgst)\b/i);
  const tipHit = pick(/\b(tip|gratuity|service charge)\b/i);
  const allMoney = lines.flatMap(moneyIn);
  const amount = totalHit?.cents ?? (allMoney.length ? Math.max(...allMoney) : 0);
  if (totalHit) evidence.total = totalHit.line;

  const date = findDate(text);
  if (date) evidence.date = date.line;

  const skip = /total|tax|tip|gratuity|change|cash|card|visa|amex|mastercard|balance|due|paid|gst|vat/i;
  const line_items = lines
    .filter((l) => !skip.test(l) && moneyIn(l).length === 1 && /[a-z]{2}/i.test(l))
    .slice(0, 20)
    .map((l) => ({ name: l.replace(MONEY, "").replace(/[$₹€£]/g, "").trim().slice(0, 80), amount_cents: moneyIn(l)[0] }));

  let confidence = 0.2;
  if (totalHit) confidence += 0.35;
  else if (amount) confidence += 0.1;
  if (date) confidence += 0.15;
  if (vendor) confidence += 0.1;
  if (line_items.length) confidence += 0.05;
  confidence = Math.min(0.92, confidence * Math.min(1, 0.4 + ocrConfidence / 150));
  const ocr = Math.min(1, 0.4 + ocrConfidence / 150);
  const symbol = currencyFromSymbol(text);
  if (taxHit) evidence.tax = taxHit.line;
  if (tipHit) evidence.tip = tipHit.line;
  const r2 = (n: number) => Number(n.toFixed(2));
  const field_confidence: Record<string, number> = {
    vendor: r2((vendor ? 0.7 : 0.1) * ocr),
    amount: r2((totalHit ? 0.9 : amount ? 0.35 : 0) * ocr),
    date: r2((date ? 0.85 : 0.1) * ocr),
    currency: symbol ? 0.9 : 0.4,
    ...(taxHit ? { tax: r2(0.8 * ocr) } : {}),
    ...(tipHit ? { tip: r2(0.8 * ocr) } : {}),
  };

  return {
    vendor,
    amount_cents: amount,
    currency: symbol ?? "USD",
    txn_date: date?.iso ?? null,
    tax_cents: taxHit?.cents ?? 0,
    tip_cents: tipHit?.cents ?? 0,
    line_items,
    payment_last4: text.match(/(?:[*xsk]{3,}|ending(?: in)?)\s*(\d{4})\b/i)?.[1] ?? null,
    confidence: Number(confidence.toFixed(2)),
    notes: totalHit ? "" : "No labelled total found; used the largest amount. Please confirm.",
    evidence,
    field_confidence,
  };
}

export async function extractReceiptLocal(file: Buffer, mime: string): Promise<{ extract: ReceiptExtract; rawText: string }> {
  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(file));
    const { text } = await extractText(pdf, { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n") : text;
    if (!raw.trim()) {
      return {
        rawText: "",
        extract: { vendor: "", amount_cents: 0, currency: "USD", txn_date: null, tax_cents: 0, tip_cents: 0, line_items: [], payment_last4: null, confidence: 0.1, notes: "Scanned PDF without a text layer. Add an AI key for vision extraction, or enter fields manually.", evidence: {}, field_confidence: { vendor: 0, amount: 0, date: 0 } },
      };
    }
    return { rawText: raw, extract: parseReceiptText(raw, 95) };
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { cachePath: os.tmpdir() });
  try {
    const { data } = await worker.recognize(file);
    return { rawText: data.text, extract: parseReceiptText(data.text, data.confidence) };
  } finally {
    await worker.terminate();
  }
}

export function parseTextLocal(text: string, members: AiMember[], today: string): TextClaim {
  const amt = text.match(/(?:[$₹€£]|rs\.?\s?)\s?([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s?(?:usd|inr|dollars|bucks|rupees|rs)\b/i);
  const cents = amt ? toCents(amt[1] ?? amt[2]) : null;
  const mentions = [...text.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase());
  const payees = members.filter((m) => mentions.includes(m.handle.toLowerCase())).map((m) => m.name);
  const vendor =
    text.match(/\b(?:at|from)\s+([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*)*)/)?.[1] ??
    text.match(/\bfor\s+([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*)*)/)?.[1] ??
    text.match(/^\s*([A-Z][\w'&]+)\s+[$₹€£]/)?.[1] ??
    null;
  // An explicit date wins; "yesterday" is relative; otherwise today is only a guess (low date confidence).
  const explicit = findDate(text)?.iso ?? null;
  const yesterday = /yesterday/i.test(text);
  const txn_date = explicit ?? (yesterday ? new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10) : today);
  const confident = cents !== null && payees.length === mentions.length;
  return {
    amount_cents: cents ?? 0,
    currency: currencyFromSymbol(text) ?? (/\b(rs|rupees|inr)\b/i.test(text) ? "INR" : "USD"),
    vendor,
    payee_names: payees,
    payer_name: null,
    includes_payer: /\b(me|myself)\b/i.test(text),
    txn_date,
    note: text.slice(0, 200),
    confidence: confident ? (vendor ? 0.84 : 0.72) : 0.4,
    field_confidence: {
      amount: cents === null ? 0 : 0.9,
      vendor: vendor ? 0.75 : 0.2,
      date: explicit || yesterday || /\btoday\b/i.test(text) ? 0.85 : 0.5,
      currency: currencyFromSymbol(text) ? 0.9 : 0.5,
      payees: payees.length === mentions.length ? 0.85 : 0.3,
    },
  };
}
