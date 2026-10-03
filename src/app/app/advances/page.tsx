import { HandCoinsIcon } from "@phosphor-icons/react/ssr";
import { AdvanceForm, SettleAdvance } from "@/components/settings/advances-client";
import { Empty, Money, PageHeader, Pill } from "@/components/ui";
import { advancesWithSpend } from "@/lib/advances";
import { requirePageCtx } from "@/lib/auth";
import { workspaceMembers } from "@/lib/claims";

export const metadata = { title: "Advances" };

/** Money advanced for trips and events against the claims it actually paid for, and what's left. */
export default async function Advances() {
  const ctx = await requirePageCtx();
  const [rows, members] = await Promise.all([advancesWithSpend(ctx.workspace.id, ctx.isAdmin ? undefined : ctx.user.id), workspaceMembers(ctx.workspace.id)]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";
  return (
    <>
      <PageHeader title="Advances" sub="Money handed out up front for travel or events, reconciled against the claims it paid for." />
      {ctx.isAdmin && <AdvanceForm members={members.map((m) => ({ id: m.id, name: m.name }))} />}
      {rows.length === 0 ? (
        <Empty icon={<HandCoinsIcon className="size-5" aria-hidden />} title="No advances" body="Record an advance, then mark claims as paid from it under 'Split who paid'." />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="rounded-[12px] border border-line bg-panel p-5 text-sm shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {name(a.userId)} · {a.purpose}
                  {a.reference && <span className="ml-2 font-mono text-xs text-muted">{a.reference}</span>}
                </p>
                <Pill tone={a.status === "open" ? "accent" : "success"} dot>
                  {a.status === "open" ? "Open" : "Settled"}
                </Pill>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-muted">Advanced</dt>
                  <dd><Money cents={a.advancedCents} currency={a.currency} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Spent on claims</dt>
                  <dd><Money cents={a.spentCents} currency={a.currency} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{a.overspentCents ? "Overspent" : "Left to return"}</dt>
                  <dd className="font-semibold"><Money cents={a.overspentCents || a.leftCents} currency={a.currency} /></dd>
                </div>
              </dl>
              {a.claims.length > 0 && <p className="mt-2 text-xs text-muted">Paid for {a.claims.map((c) => `#${c.number} ${c.vendor}`).join(", ")}</p>}
              {a.settlement && <p className="mt-2 text-xs text-ink-2">{a.settlement}</p>}
              {ctx.isAdmin && a.status === "open" && <SettleAdvance id={a.id} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
