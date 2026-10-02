import Link from "next/link";
import { cx, PageHeader } from "@/components/ui";
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
      <nav aria-label="Filter" className="mb-5 inline-flex flex-wrap gap-0.5 rounded-[10px] bg-sunken p-1">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/app/activity" : `/app/activity?type=${t}`}
            aria-current={type === t ? "page" : undefined}
            className={cx("rounded-[7px] px-3 py-1.5 text-[13px] capitalize", type === t ? "bg-panel font-medium text-ink shadow-soft" : "text-muted hover:text-ink")}
          >
            {t === "ai" ? "AI" : t}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-[12px] border border-line">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-normal">When</th>
              <th className="px-5 py-3 font-normal">Actor</th>
              <th className="px-5 py-3 font-normal">Action</th>
              <th className="px-5 py-3 font-normal">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ e, actor }) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 text-muted tnum">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="whitespace-nowrap px-5 py-3 font-medium">{actor ?? "System"}</td>
                <td className="px-5 py-3">
                  {describe(e.action)}
                  <p className="font-mono text-[11px] text-muted">{e.action}</p>
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-muted">
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
        {!rows.length && <p className="p-8 text-center text-sm text-muted">No events yet.</p>}
      </div>
    </>
  );
}
