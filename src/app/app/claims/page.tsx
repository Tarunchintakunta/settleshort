import { desc, eq } from "drizzle-orm";
import { PlusIcon, TrayIcon } from "@phosphor-icons/react/ssr";
import { ClaimsGrid } from "@/components/claims/claims-grid";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { factsFor } from "@/lib/claim-facts";
import { claims, db, users } from "@/lib/db";

export const metadata = { title: "Claims" };

export default async function ClaimsPage() {
  const ctx = await requirePageCtx();
  const rows = await db
    .select({ c: claims, payer: users.name })
    .from(claims)
    .innerJoin(users, eq(users.id, claims.payerUserId))
    .where(eq(claims.workspaceId, ctx.workspace.id))
    .orderBy(desc(claims.number));
  const facts = await factsFor(rows.map((r) => r.c));

  return (
    <>
      <PageHeader
        title="Claims"
        sub="Every expense your team has paid for, read, matched and ready to settle."
        actions={
          <ButtonLink href="/app/claims/new">
            <PlusIcon className="size-4" weight="bold" aria-hidden /> New claim
          </ButtonLink>
        }
      />
      {rows.length ? (
        <ClaimsGrid
          isAdmin={ctx.isAdmin}
          rows={rows.map(({ c, payer }) => ({
            id: c.id,
            number: c.number,
            txnDate: c.txnDate,
            vendor: c.vendor,
            amountCents: c.amountCents,
            currency: c.currency,
            payer,
            source: c.source,
            aiConfidence: c.aiConfidence,
            provider: (c.aiJson as { provider?: string } | null)?.provider,
            status: c.status,
            duplicate: !!c.duplicateOfId && c.status === "pending_review",
            truth: { label: facts.get(c.id)!.truth.label, tone: facts.get(c.id)!.truth.tone },
          }))}
        />
      ) : (
        <Empty
          icon={<TrayIcon className="size-5" aria-hidden />}
          title="No claims yet"
          body="Upload a receipt or paste a Slack message. The fields fill themselves in."
          action={<ButtonLink href="/app/claims/new">Create the first claim</ButtonLink>}
        />
      )}
    </>
  );
}
