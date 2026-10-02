import { PageHeader, Pill } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth";

export const metadata = { title: "Integrations" };

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-[10px] border border-line bg-sunken p-4 font-mono text-xs leading-relaxed text-ink-2">{children}</pre>;
}

export default async function IntegrationsPage() {
  const ctx = await requirePageCtx();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <>
      <PageHeader title="Integrations" sub="Bring claims in from Slack and keep payout status in sync." />
      <div className="space-y-6">
        <section className="rounded-[12px] border border-line p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Slack to SettleShort, through Zapier</h2>
            <Pill tone={process.env.ZAPIER_WEBHOOK_SECRET ? "success" : "warning"}>{process.env.ZAPIER_WEBHOOK_SECRET ? "Secret configured" : "Secret not set"}</Pill>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Zapier trigger: Slack, New Message Posted to Channel (for example #expenses).</li>
            <li>Action: Webhooks by Zapier, POST, payload type JSON.</li>
            <li>Map the message text and the sender email as below. The AI parses it into a claim.</li>
          </ol>
          <Code>{`POST ${base}/api/v1/webhooks/zapier
x-settleshort-secret: <ZAPIER_WEBHOOK_SECRET>
Content-Type: application/json

{
  "workspace_slug": "${ctx.workspace.slug}",
  "text": "I paid $42.30 for Uber for @rita yesterday",
  "from_email": "rita@yourco.com"
}`}</Code>
        </section>
        <section className="rounded-[12px] border border-line p-6">
          <h2 className="text-sm font-medium">PayPal webhooks</h2>
          <p className="mt-1 text-sm text-muted">
            In your PayPal developer app, add a webhook to this URL and copy its ID into <span className="font-mono">PAYPAL_WEBHOOK_ID</span>. Every event is verified with PayPal before it touches a batch. Refresh status on a batch is the polling fallback.
          </p>
          <Code>{`${base}/api/v1/webhooks/paypal

PAYMENT.PAYOUTSBATCH.SUCCESS
PAYMENT.PAYOUTSBATCH.DENIED
PAYMENT.PAYOUTS-ITEM.SUCCEEDED
PAYMENT.PAYOUTS-ITEM.FAILED
PAYMENT.PAYOUTS-ITEM.UNCLAIMED`}</Code>
        </section>
      </div>
    </>
  );
}
