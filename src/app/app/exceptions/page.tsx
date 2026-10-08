import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { Empty, PageHeader, Pill, tabBtn } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { workspaceExceptions, type Exception } from "@/lib/exceptions";
import { runEscalations } from "@/lib/escalations";

export const metadata = { title: "Exceptions" };

const KIND: Record<Exception["kind"], { label: string; tone: "warning" | "danger" | "accent" }> = {
  conflict: { label: "Conflict", tone: "danger" },
  payout: { label: "Payout", tone: "danger" },
  stuck: { label: "Stuck", tone: "warning" },
  large: { label: "Large", tone: "accent" },
  spend: { label: "SaaS spend", tone: "accent" },
  risk: { label: "Soft fraud signal", tone: "warning" },
};

/** Founder inbox: only what needs a decision. Routine claims and payouts never show up here. */
export default async function Exceptions({ searchParams }: PageProps<"/app/exceptions">) {
  const ctx = await requirePageCtx();
  if (!ctx.isAdmin) redirect("/app/me");
  // Opening the inbox also moves overdue approvals up the chain (idempotent; the daily cron does the same).
  await runEscalations(ctx.workspace);
  const all = await workspaceExceptions(ctx.workspace);
  const riskOnly = (await searchParams).filter === "risk";
  const items = riskOnly ? all.filter((e) => e.kind === "risk") : all;
  return (
    <>
      <PageHeader title="Exceptions" sub="Only what's stuck, conflicting, unusually large or uncertain. Everything routine is handled without you." />
      <nav aria-label="Filter exceptions" className="mb-3 flex flex-wrap gap-0.5 self-start rounded-[10px] bg-sunken p-1">
        <Link href="/app/exceptions" aria-current={!riskOnly ? "page" : undefined} className={tabBtn(!riskOnly)}>
          All <span className="tnum ml-1 opacity-60">{all.length}</span>
        </Link>
        <Link href="/app/exceptions?filter=risk" aria-current={riskOnly ? "page" : undefined} className={tabBtn(riskOnly)}>
          Has soft fraud signal <span className="tnum ml-1 opacity-60">{all.filter((e) => e.kind === "risk").length}</span>
        </Link>
      </nav>
      {items.length === 0 ? (
        <Empty icon={<CheckCircleIcon className="size-5" aria-hidden />} title="Nothing needs you" body="No stuck, conflicting or unusual claims. Payouts are clean." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-panel shadow-soft">
          {items.map((e) => (
            <li key={e.key}>
              <Link href={e.href} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-sunken">
                <Pill tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Pill>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-[13px] text-ink-2">{e.why}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
                  {e.action} <ArrowRightIcon className="size-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
