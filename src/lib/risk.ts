// Soft fraud signals: hints for a human reviewer. They never reject or pay anything on their own.
import { normalizeMerchant } from "./matching";

export type RiskClaim = {
  id: string;
  number: number;
  vendor: string;
  amountCents: number;
  currency: string;
  /** Calendar date from the receipt, already in the workspace's local day, so no timezone shift applies. */
  txnDate: string | null;
  status: string;
  /** Claim ids a person already marked "different expense" (matchJson.dismissed). */
  dismissed?: string[];
};

export type RiskSignal = {
  id: "DUP_EXACT" | "DUP_NEAR_AMOUNT" | "DUP_VENDOR_WEEK";
  severity: "high" | "medium" | "low";
  message: string;
  related: { id: string; number: number }[];
};

const IGNORED_VENDORS = new Set(["", "unknown", "unknown vendor"]);
// "±$1 / ₹50, whichever is larger": a currency floor in minor units next to 2% of the amount.
const NEAR_FLOOR: Record<string, number> = { INR: 5000 };
const vendorKey = (v: string) => normalizeMerchant(v.trim());
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const refs = (cs: RiskClaim[]) => cs.map((c) => `#${c.number}`).join(", ");

/** Signals for `claim` against the rest of its workspace. Rejected claims are never match targets. */
export function riskSignals(claim: RiskClaim, workspace: RiskClaim[]): RiskSignal[] {
  const key = vendorKey(claim.vendor);
  if (IGNORED_VENDORS.has(key) || !claim.txnDate) return [];
  const peers = workspace.filter(
    (o) => o.id !== claim.id && o.status !== "rejected" && o.txnDate && vendorKey(o.vendor) === key && !claim.dismissed?.includes(o.id) && !o.dismissed?.includes(claim.id),
  );
  const sameDay = peers.filter((o) => o.txnDate === claim.txnDate && o.currency === claim.currency);
  const exact = sameDay.filter((o) => o.amountCents === claim.amountCents);
  const tolerance = Math.max(Math.round(claim.amountCents * 0.02), NEAR_FLOOR[claim.currency] ?? 100);
  const near = sameDay.filter((o) => o.amountCents !== claim.amountCents && Math.abs(o.amountCents - claim.amountCents) <= tolerance);
  // ponytail: ±6 days around the claim's date stands in for "this week"; flags every claim in the cluster.
  const week = peers.filter((o) => days(o.txnDate!, claim.txnDate!) <= 6);

  const out: RiskSignal[] = [];
  const rel = (cs: RiskClaim[]) => cs.map((c) => ({ id: c.id, number: c.number }));
  if (exact.length) out.push({ id: "DUP_EXACT", severity: "high", message: `Possible duplicate: same vendor, amount, and day as ${refs(exact)}`, related: rel(exact) });
  if (near.length) out.push({ id: "DUP_NEAR_AMOUNT", severity: "medium", message: `Similar amount same day as ${refs(near)}`, related: rel(near) });
  if (week.length >= 2) out.push({ id: "DUP_VENDOR_WEEK", severity: "low", message: `${week.length + 1} claims at this vendor this week`, related: rel(week) });
  return out;
}

export const hasHighRisk = (s: RiskSignal[]) => s.some((x) => x.severity === "high");
/** High or medium: what earns the "Duplicate?" chip. */
export const flaggedRisk = (s: RiskSignal[]) => s.filter((x) => x.severity !== "low");

/** Maps a claims row (or its fields) to the shape riskSignals reads. */
export const toRiskClaim = (c: Omit<RiskClaim, "dismissed"> & { matchJson?: unknown }): RiskClaim => ({
  id: c.id,
  number: c.number,
  vendor: c.vendor,
  amountCents: c.amountCents,
  currency: c.currency,
  txnDate: c.txnDate,
  status: c.status,
  dismissed: (c.matchJson as { dismissed?: string[] } | null)?.dismissed ?? [],
});
