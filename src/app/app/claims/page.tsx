import { desc, eq } from "drizzle-orm";
import { PlusIcon, TrayIcon } from "@phosphor-icons/react/ssr";
import { ClaimsGrid } from "@/components/claims/claims-grid";
import { ButtonLink, Empty, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";
import { riskSignalsFor } from "@/lib/approvals";
import { flaggedRisk } from "@/lib/risk";
import { factsFor } from "@/lib/claim-facts";
import { claims, db, users } from "@/lib/db";
import { claimTitle } from "@/lib/title";

export const metadata = { title: "Claims" };

export default async function ClaimsPage() {
  const ctx = await requirePageCtx();
  const rows = await db
    .select({ c: claims, payer: users.name })
    .from(claims)
    .innerJoin(users, eq(users.id, claims.payerUserId))
    .where(eq(claims.workspaceId, ctx.workspace.id))
    .orderBy(desc(claims.number));
  const [facts, risk] = await Promise.all([factsFor(rows.map((r) => r.c)), riskSignalsFor(ctx.workspace.id)]);
  // Claim numbers behind any High or Medium soft-fraud signal; drives the "Duplicate?" chip and its tooltip.
  const riskRefs = (id: string) => [...new Set(flaggedRisk(risk.get(id) ?? []).flatMap((s) => s.related.map((r) => r.number)))];

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
            title: claimTitle(c),
            amountCents: c.amountCents,
            currency: c.currency,
            payer,
            source: c.source,
            aiConfidence: c.aiConfidence,
            provider: (c.aiJson as { provider?: string } | null)?.provider,
            status: c.status,
            duplicate: !!c.duplicateOfId && c.status === "pending_review",
            riskRefs: ["paid", "rejected"].includes(c.status) ? [] : riskRefs(c.id),
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
