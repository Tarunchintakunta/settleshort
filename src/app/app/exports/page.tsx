import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";

export const metadata = { title: "Exports" };

/** The month-end pack for the accountant: one CSV plus every claim's closure record, printable as one PDF. */
export default async function Exports({ searchParams }: PageProps<"/app/exports">) {
  const ctx = await requirePageCtx();
  if (!ctx.isAdmin) redirect("/app");
  const sp = await searchParams;
  const now = new Date();
  const from = typeof sp.from === "string" ? sp.from : new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to = typeof sp.to === "string" ? sp.to : now.toISOString().slice(0, 10);
  const q = `from=${from}&to=${to}`;
  return (
    <>
      <PageHeader title="Exports" sub="An accountant-ready evidence pack: receipts and declarations, categories, approvals, adjustments, PayPal references and anything unresolved." />
      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1.5">
          From
          <input type="date" name="from" defaultValue={from} className="h-10 rounded-[8px] border border-line bg-panel px-3" />
        </label>
        <label className="flex flex-col gap-1.5">
          To
          <input type="date" name="to" defaultValue={to} className="h-10 rounded-[8px] border border-line bg-panel px-3" />
        </label>
        <button className="h-10 rounded-[8px] border border-line bg-panel px-4 font-medium hover:bg-sunken">Update range</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`/api/v1/exports/claims?${q}`} className="rounded-[12px] border border-line bg-panel p-5 shadow-soft transition-colors hover:border-line-strong hover:bg-sunken">
          <p className="font-medium">Download the CSV</p>
          <p className="mt-1 text-sm text-muted">One row per claim, with a link to each closure record.</p>
        </a>
        <a href={`/app/exports/pack?${q}`} className="rounded-[12px] border border-line bg-panel p-5 shadow-soft transition-colors hover:border-line-strong hover:bg-sunken">
          <p className="font-medium">Open the printable pack</p>
          <p className="mt-1 text-sm text-muted">Every closure record in the range on one page. Print or save as PDF.</p>
        </a>
      </div>
    </>
  );
}
