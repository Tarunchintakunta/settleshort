import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon, CircleDashedIcon } from "@phosphor-icons/react/ssr";
import { PageHeader, PROVIDER_LABEL } from "@/components/ui";
import { SettingsForm } from "@/components/settings/settings-form";
import { aiProvider } from "@/lib/ai";
import { requirePageCtx } from "@/lib/auth";
import { paypalMode } from "@/lib/paypal";

export const metadata = { title: "Settings" };

function Status({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      {ok ? <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-success" weight="fill" aria-hidden /> : <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requirePageCtx();
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <>
      <PageHeader title="Settings" sub="Workspace, safety caps and connections." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="mb-4 text-sm font-medium">Workspace and safety caps</h2>
          <SettingsForm ws={ctx.workspace} isAdmin={ctx.isAdmin} />
        </section>
        <div className="space-y-6">
          <section className="space-y-5 rounded-[12px] border border-line p-5">
            <h2 className="text-sm font-medium">Connections</h2>
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
            <div className="flex items-center justify-between rounded-[12px] border border-line p-5 transition-colors hover:bg-sunken">
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
