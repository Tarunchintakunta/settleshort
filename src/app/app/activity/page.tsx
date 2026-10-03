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
                  <td className="tnum px-5 py-3.5 text-[12.5px] whitespace-nowrap text-muted">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-5 py-3.5 font-medium whitespace-nowrap">{actor ?? "System"}</td>
                  <td className="px-5 py-3.5 first-letter:uppercase">{describe(e.action)}</td>
                  <td className="min-w-[220px] px-5 py-3.5">
                    {details(e.metaJson).length ? (
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-relaxed">
                        {details(e.metaJson).map(([k, v]) => (
                          <div key={k} className="flex min-w-0 gap-1.5">
                            <dt className="shrink-0 whitespace-nowrap text-muted">{k}</dt>
                            <dd className={cx("min-w-0 text-ink-2 [overflow-wrap:break-word] [word-break:normal]", /^[$₹€£]/.test(v) ? "money font-medium" : "font-mono text-[11.5px]")}>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span className="text-xs text-muted">No details</span>
                    )}
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

/** Audit meta as readable label/value pairs. Machine keys become plain words; nested values stay compact. */
function details(meta: unknown): [string, string][] {
  if (!meta || typeof meta !== "object") return [];
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      const label = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
      const value = typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "object" ? (Array.isArray(v) ? v.join(", ") : Object.keys(v as object).join(", ")) : String(v);
      return [label, value];
    });
}
