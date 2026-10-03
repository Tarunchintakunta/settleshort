import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import Link from "next/link";
import { WalletIcon } from "@phosphor-icons/react/ssr";
import { Empty, Money, PageHeader, Pill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { factsFor } from "@/lib/claim-facts";
import { claimPayments, claims, db, ledgerEntries } from "@/lib/db";
import { obligationsForMany } from "@/lib/ledger";

export const metadata = { title: "My money" };

/** What the company owes me, claim by claim, including partial, disputed and owed-back amounts. */
export default async function MyMoney() {
  const ctx = await requirePageCtx();
  const me = ctx.user.id;
  const linked = await Promise.all([
    db.select({ id: claimPayments.claimId }).from(claimPayments).where(eq(claimPayments.userId, me)),
    db.select({ id: ledgerEntries.claimId }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, me), eq(ledgerEntries.workspaceId, ctx.workspace.id))),
  ]);
  const extra = [...new Set(linked.flat().map((r) => r.id))];
  const rows = await db
    .select()
    .from(claims)
    .where(and(eq(claims.workspaceId, ctx.workspace.id), ne(claims.status, "rejected"), or(eq(claims.payerUserId, me), extra.length ? inArray(claims.id, extra) : undefined)))
    .orderBy(desc(claims.createdAt));
  const [owed, facts] = await Promise.all([obligationsForMany(rows), factsFor(rows)]);
  const mine = rows
    .map((c) => ({ c, p: owed.get(c.id)!.payees.find((p) => p.userId === me), truth: facts.get(c.id)!.truth }))
    .filter((r): r is typeof r & { p: NonNullable<typeof r.p> } => !!r.p);

  // Totals per currency: never add rupees to dollars.
  const totals = new Map<string, { outstanding: number; settled: number; back: number; held: number }>();
  for (const { c, p, truth } of mine) {
    const t = totals.get(c.currency) ?? { outstanding: 0, settled: 0, back: 0, held: 0 };
    if (p.outstandingCents > 0 && c.status !== "pending_review") t.outstanding += p.outstandingCents;
    if (c.status === "pending_review") t.held += p.owedCents;
    if (p.outstandingCents < 0) t.back += -p.outstandingCents;
    t.settled += p.settledCents;
    if (truth.key === "investigating") t.held += p.owedCents;
    totals.set(c.currency, t);
  }

  return (
    <>
      <PageHeader title="My money" sub="What the company owes you, what's been paid, and where each reimbursement is right now." />
      {mine.length === 0 ? (
        <Empty icon={<WalletIcon className="size-5" aria-hidden />} title="Nothing owed to you" body="When you pay for something for the team, submit it and it shows up here until the money lands." />
      ) : (
        <>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...totals].flatMap(([cur, t]) => [
              { label: `Approved, still owed (${cur})`, cents: t.outstanding, cur },
              { label: `Waiting for approval or under investigation (${cur})`, cents: t.held, cur },
              { label: `Already paid to you (${cur})`, cents: t.settled, cur },
              ...(t.back ? [{ label: `You owe back (${cur})`, cents: t.back, cur }] : []),
            ]).map((m) => (
              <div key={m.label} className="rounded-[12px] border border-line bg-panel p-4 shadow-soft">
                <p className="text-xs text-muted">{m.label}</p>
                <Money cents={m.cents} currency={m.cur} className="mt-1 block text-[24px] font-semibold" />
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-[12px] border border-line shadow-soft">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Claim</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Owed</th>
                  <th className="px-5 py-3 text-right font-medium">Paid</th>
                  <th className="px-5 py-3 text-right font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map(({ c, p, truth }) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3.5">
                      <Link href={`/app/claims/${c.id}`} className="hover:underline">
                        <span className="tnum text-muted">#{c.number}</span> {c.vendor || "Untitled claim"}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Pill tone={truth.tone} dot>
                        {truth.label}
                      </Pill>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Money cents={p.owedCents} currency={c.currency} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Money cents={p.settledCents} currency={c.currency} className="text-ink-2" />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.outstandingCents >= 0 ? (
                        <Money cents={p.outstandingCents} currency={c.currency} className="font-semibold" />
                      ) : (
                        <span className="font-semibold text-warning">
                          −<Money cents={-p.outstandingCents} currency={c.currency} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
