import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { PageHeader, PROVIDER_LABEL } from "@/components/ui";
import { SettingsForm } from "@/components/settings/settings-form";
import { MerchantRules } from "@/components/settings/merchant-rules";
import { db, merchantMappings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { aiProvider } from "@/lib/ai";
import { requirePageCtx } from "@/lib/auth";
import { workspaceMembers } from "@/lib/claims";
import { paypalMode } from "@/lib/paypal";

export const metadata = { title: "Settings" };

function Status({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className={ok ? "mt-1.5 size-2 shrink-0 rounded-full bg-success" : "mt-1.5 size-2 shrink-0 rounded-full bg-warning"} aria-hidden />
      <div>
        <p className="text-sm font-medium tracking-[-0.011em]">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requirePageCtx();
  const [members, rules] = await Promise.all([
    workspaceMembers(ctx.workspace.id),
    db.select().from(merchantMappings).where(eq(merchantMappings.workspaceId, ctx.workspace.id)).orderBy(merchantMappings.merchantLabel),
  ]);
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <>
      <PageHeader title="Settings" sub="Workspace, safety caps and connections." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-[12px] border border-line p-6 shadow-soft">
          <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.015em]">Workspace and safety caps</h2>
          <p className="mb-5 text-sm text-muted">Approve is blocked above these limits, and nobody approves their own claim.</p>
          <SettingsForm ws={ctx.workspace} isAdmin={ctx.isAdmin} members={members} />
          <h2 className="mt-8 mb-1 text-[15px] font-semibold tracking-[-0.015em]">Merchant rules</h2>
          <p className="mb-3 text-sm text-muted">How recurring vendors are categorized. Only a person creates or changes a rule.</p>
          <MerchantRules isAdmin={ctx.isAdmin} rules={rules.map((r) => ({ ...r, confirmedBy: members.find((m) => m.id === r.confirmedBy)?.name ?? "Unknown" }))} />
        </section>
        <div className="space-y-6">
          <section className="space-y-5 rounded-[12px] border border-line p-6 shadow-soft">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">Connections</h2>
            <Status
              ok={pp === "sandbox"}
              title={pp === "sandbox" ? "PayPal Sandbox connected" : "PayPal simulator"}
              body={pp === "sandbox" ? "Payouts go to api-m.sandbox.paypal.com. Live endpoints are refused in code." : "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to call the real sandbox."}
            />
            <Status
              ok
              title={`Extraction: ${PROVIDER_LABEL[ai]}`}
              body={
                ai === "claude"
                  ? `${process.env.AI_MODEL_CLAUDE ?? "claude-opus-5-5"} reads photos and PDFs with structured output.`
                  : ai === "openai"
                    ? `${process.env.AI_MODEL_VISION ?? "gpt-4o"} for receipts, ${process.env.AI_MODEL_TEXT ?? "gpt-4o-mini"} for messages.`
                    : "Tesseract OCR plus a deterministic parser, no key needed. Set ANTHROPIC_API_KEY for vision-model extraction."
              }
            />
          </section>
          <Link href="/app/settings/integrations" className="block">
            <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line p-5 shadow-soft transition-colors hover:border-line-strong hover:bg-sunken">
              <div>
                <p className="text-sm font-medium">Integrations</p>
                <p className="text-sm text-muted">Slack through Zapier, PayPal webhooks</p>
              </div>
              <ArrowRightIcon className="size-4 text-muted" aria-hidden />
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
