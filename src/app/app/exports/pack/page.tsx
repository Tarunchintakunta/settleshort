import { redirect } from "next/navigation";
import { ClosureRecord } from "@/components/claims/closure-record";
import { requirePageCtx } from "@/lib/auth";
import { claimsInRange } from "@/lib/export";

export const metadata = { title: "Evidence pack" };

export default async function Pack({ searchParams }: PageProps<"/app/exports/pack">) {
  const ctx = await requirePageCtx();
  if (!ctx.isAdmin) redirect("/app");
  const sp = await searchParams;
  const from = String(sp.from ?? "2000-01-01");
  const to = String(sp.to ?? new Date().toISOString().slice(0, 10));
  const rows = (await claimsInRange(ctx.workspace.id, from, to)).filter((c) => c.status !== "rejected");
  return (
    <div className="space-y-16">
      <p className="text-sm text-muted print:hidden">
        {rows.length} claims from {from} to {to}. Use your browser&apos;s Print to save this pack as a PDF.
      </p>
      {await Promise.all(rows.map(async (c) => <div key={c.id} className="break-after-page">{await ClosureRecord({ id: c.id, workspace: ctx.workspace, back: false })}</div>))}
    </div>
  );
}
