import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { workspaceExceptions, type Exception } from "@/lib/exceptions";

export const metadata = { title: "Exceptions" };

const KIND: Record<Exception["kind"], { label: string; tone: "warning" | "danger" | "accent" }> = {
  conflict: { label: "Conflict", tone: "danger" },
  payout: { label: "Payout", tone: "danger" },
  stuck: { label: "Stuck", tone: "warning" },
  large: { label: "Large", tone: "accent" },
};

/** Founder inbox: only what needs a decision. Routine claims and payouts never show up here. */
export default async function Exceptions() {
  const ctx = await requirePageCtx();
  if (!ctx.isAdmin) redirect("/app/me");
  const items = await workspaceExceptions(ctx.workspace);
  return (
    <>
      <PageHeader title="Exceptions" sub="Only what's stuck, conflicting, unusually large or uncertain. Everything routine is handled without you." />
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
