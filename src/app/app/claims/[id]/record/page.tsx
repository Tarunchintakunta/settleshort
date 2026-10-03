import { notFound } from "next/navigation";
import { ClosureRecord } from "@/components/claims/closure-record";
import { requirePageCtx } from "@/lib/auth";

export const metadata = { title: "Closure record" };

export default async function ClosureRecordPage({ params }: PageProps<"/app/claims/[id]/record">) {
  const { id } = await params;
  const ctx = await requirePageCtx();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const record = await ClosureRecord({ id, workspace: ctx.workspace });
  if (!record) notFound();
  return record;
}
