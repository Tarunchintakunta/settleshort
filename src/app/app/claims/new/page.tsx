import { count, eq } from "drizzle-orm";
import { NewClaim } from "@/components/claims/new-claim";
import { PageHeader } from "@/components/ui";
import { aiProvider } from "@/lib/ai";
import { requirePageCtx } from "@/lib/auth";
import { claims, db } from "@/lib/db";

export const metadata = { title: "New claim" };

export default async function NewClaimPage() {
  const ctx = await requirePageCtx();
  const [{ n }] = await db.select({ n: count() }).from(claims).where(eq(claims.workspaceId, ctx.workspace.id));
  return (
    <>
      <PageHeader title="New claim" sub="Upload a receipt or paste the message. You see exactly what was read, and nothing is paid until an admin approves." />
      <NewClaim provider={aiProvider()} claimCount={n} />
    </>
  );
}
