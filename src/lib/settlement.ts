// Pure money math for "what is actually owed". No DB access; unit-tested.

export const FUNDING_SOURCES = ["employee", "company_card", "advance"] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

/** Who put money down for the expense. `userId` is null for company money. */
export type Payment = { userId: string | null; source: FundingSource; amountCents: number };

export const LEDGER_KINDS = ["payout", "payout_reversal", "repayment", "refund", "clawback"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];
export type LedgerEntry = { userId: string; kind: LedgerKind; amountCents: number };

/**
 * How each ledger kind moves the balance the company owes an employee.
 * payout/repayment: company paid them. refund: the merchant refunded them, so less is owed.
 * payout_reversal: a payout bounced back. clawback: they returned money to the company.
 */
const EFFECT: Record<LedgerKind, 1 | -1> = { payout: -1, repayment: -1, refund: -1, payout_reversal: 1, clawback: 1 };

/** Splits `total` across weights without losing a cent (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

export type PayeeLine = {
  userId: string;
  paidCents: number;
  owedCents: number;
  settledCents: number;
  outstandingCents: number;
  /** Outstanding minus this person's share of held or disputed lines: what can be paid today. */
  payableNowCents: number;
};

export type Obligations = {
  totalCents: number;
  /** Excluded as personal (line items). Nobody is reimbursed for it. */
  excludedCents: number;
  /** Held or disputed lines: still owed, but not paid until resolved. */
  heldCents: number;
  companyFundedCents: number;
  advanceFundedCents: number;
  employeeFundedCents: number;
  /** What the company owes employees in total, before any payments. */
  reimbursableCents: number;
  payees: PayeeLine[];
  outstandingCents: number;
  /** Money employees owe back (refund after reimbursement, over-payment). */
  owedBackCents: number;
};

/**
 * The obligation breakdown for one claim. Only employee-funded money is reimbursed; personal exclusions
 * reduce each employee payer's share in proportion to what they paid.
 * With no payment rows, the single payer is assumed to have paid the whole amount.
 */
export function computeObligations(input: {
  totalCents: number;
  payerUserId: string;
  payments?: Payment[];
  excludedCents?: number;
  heldCents?: number;
  ledger?: LedgerEntry[];
}): Obligations {
  const { totalCents } = input;
  const payments = input.payments?.length ? input.payments : [{ userId: input.payerUserId, source: "employee" as const, amountCents: totalCents }];
  const by = (s: FundingSource) => payments.filter((p) => p.source === s).reduce((a, p) => a + p.amountCents, 0);
  const employee = payments.filter((p) => p.source === "employee" && p.userId);
  const employeeFundedCents = by("employee");
  const excludedCents = Math.min(input.excludedCents ?? 0, totalCents);

  // Personal items come out of the employee-funded part first: company money never reimburses them.
  const reimbursableCents = Math.max(0, employeeFundedCents - excludedCents);
  const paidBy = new Map<string, number>();
  for (const p of employee) paidBy.set(p.userId!, (paidBy.get(p.userId!) ?? 0) + p.amountCents);
  const ids = [...paidBy.keys()];
  const owed = allocate(reimbursableCents, ids.map((u) => paidBy.get(u)!));

  const ledger = input.ledger ?? [];
  for (const e of ledger) {
    if (paidBy.has(e.userId)) continue;
    ids.push(e.userId);
    owed.push(0);
    paidBy.set(e.userId, 0);
  }
  // Held lines are carved out of each person's share in proportion to what they're owed.
  const held = allocate(Math.min(input.heldCents ?? 0, reimbursableCents), owed);
  const payees = ids.map((userId, i) => {
    const settledCents = ledger.filter((e) => e.userId === userId).reduce((a, e) => a - EFFECT[e.kind] * e.amountCents, 0);
    const outstandingCents = owed[i] - settledCents;
    return { userId, paidCents: paidBy.get(userId)!, owedCents: owed[i], settledCents, outstandingCents, payableNowCents: Math.max(0, outstandingCents - (held[i] ?? 0)) };
  });

  return {
    totalCents,
    excludedCents,
    heldCents: Math.min(input.heldCents ?? 0, reimbursableCents),
    companyFundedCents: by("company_card"),
    advanceFundedCents: by("advance"),
    employeeFundedCents,
    reimbursableCents,
    payees,
    outstandingCents: payees.reduce((a, p) => a + Math.max(0, p.outstandingCents), 0),
    owedBackCents: payees.reduce((a, p) => a + Math.max(0, -p.outstandingCents), 0),
  };
}

/** Payment rows must add up to the claim total; returns the problem or null. */
export function paymentsProblem(totalCents: number, payments: Payment[]): string | null {
  if (!payments.length) return null;
  if (payments.some((p) => p.amountCents <= 0)) return "Every payment needs a positive amount";
  if (payments.some((p) => p.source === "employee" && !p.userId)) return "Employee payments need a person";
  const sum = payments.reduce((a, p) => a + p.amountCents, 0);
  if (sum !== totalCents) return `Payments add up to ${(sum / 100).toFixed(2)} but the claim is ${(totalCents / 100).toFixed(2)}`;
  return null;
}

/** Settlement status from balances: what a claim's money state really is. */
export function moneyStatus(o: Obligations): "unpaid" | "partially_paid" | "paid" | "owes_back" | "nothing_owed" {
  if (o.owedBackCents > 0) return "owes_back";
  if (o.reimbursableCents === 0) return "nothing_owed";
  if (o.outstandingCents === 0) return "paid";
  return o.payees.some((p) => p.settledCents > 0) ? "partially_paid" : "unpaid";
}

export const LINE_STATES = ["pending", "approved", "held", "disputed"] as const;
export type LineState = (typeof LINE_STATES)[number];
export type Line = { id: string; name: string; amountCents: number; excluded: boolean; state: LineState };
export type LineRow = Line & { extraCents: number; totalCents: number };

/**
 * Spreads tax and tip over every line in proportion to its price, so excluding a personal item also
 * excludes its share of tax and tip. Anything the receipt total has beyond the lines becomes an
 * "Unitemized" row, so the breakdown always adds up to the claim total.
 */
export function lineBreakdown(totalCents: number, lines: Line[], taxCents: number, tipCents: number) {
  if (!lines.length) return { rows: [] as LineRow[], excludedCents: 0, heldCents: 0, extrasCents: 0 };
  const base = lines.reduce((a, l) => a + l.amountCents, 0);
  const extras = Math.max(0, Math.min(taxCents + tipCents, totalCents - base));
  const unitemized = totalCents - base - extras;
  const all: Line[] = unitemized !== 0 ? [...lines, { id: "unitemized", name: "Unitemized", amountCents: unitemized, excluded: false, state: "pending" }] : lines;
  const shares = allocate(extras, all.map((l) => Math.max(0, l.amountCents)));
  const rows = all.map((l, i) => ({ ...l, extraCents: shares[i], totalCents: l.amountCents + shares[i] }));
  const sum = (f: (r: LineRow) => boolean) => rows.filter(f).reduce((a, r) => a + r.totalCents, 0);
  return {
    rows,
    excludedCents: sum((r) => r.excluded),
    heldCents: sum((r) => !r.excluded && (r.state === "held" || r.state === "disputed")),
    extrasCents: extras,
  };
}

/** The conversion basis implied by two amounts, stated as "1 FROM = rate TO". */
export function impliedRate(fromCents: number, toCents: number) {
  return fromCents > 0 ? Number((toCents / fromCents).toFixed(6)) : null;
}
