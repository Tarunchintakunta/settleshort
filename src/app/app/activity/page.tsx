import Link from "next/link";
import { PulseIcon } from "@phosphor-icons/react/ssr";
import { cx, Empty, PageHeader, tabBtn, tabTrack } from "@/components/ui";
import { describe, recentActivity } from "@/lib/activity";
import { requirePageCtx } from "@/lib/auth";

export const metadata = { title: "Activity" };

const TYPES = ["all", "claim", "ai", "batch", "payout", "member", "workspace"];

export default async function ActivityPage({ searchParams }: PageProps<"/app/activity">) {
  const ctx = await requirePageCtx();
  const type = String((await searchParams).type ?? "all");
  const rows = (await recentActivity(ctx.workspace.id, 500)).filter(({ e }) => type === "all" || e.action.startsWith(type + "."));

  return (
    <>
      <PageHeader title="Activity" sub="Append-only audit trail of every extract, edit, approval and payout." />
      <nav aria-label="Filter" className={cx(tabTrack, "mb-5")}>
        {TYPES.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/app/activity" : `/app/activity?type=${t}`}
            aria-current={type === t ? "page" : undefined}
            className={cx(tabBtn(type === t), "capitalize")}
          >
            {t === "ai" ? "AI" : t}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="overflow-x-auto rounded-[12px] border border-line shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ e, actor }) => (
                <tr key={e.id} className="align-top">
                  <td className="tnum px-5 py-3.5 font-mono text-[12px] whitespace-nowrap text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-5 py-3.5 font-medium whitespace-nowrap">{actor ?? "System"}</td>
                  <td className="px-5 py-3.5">
                    {describe(e.action)}
                    <p className="mt-0.5 font-mono text-[11px] text-muted">{e.action}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
                    {e.metaJson && Object.keys(e.metaJson).length ? (
                      <span className="line-clamp-3 break-all">
                        {Object.entries(e.metaJson as Record<string, unknown>)
                          .filter(([, v]) => v !== undefined && v !== null)
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                          .join(", ")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<PulseIcon className="size-5" aria-hidden />} title="No events yet" body="Extracts, edits, approvals and payouts will show up here." />
      )}
    </>
  );
}
