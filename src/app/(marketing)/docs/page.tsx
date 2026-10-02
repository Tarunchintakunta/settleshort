import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoLink, wrap } from "@/components/marketing/Nav";

export const metadata: Metadata = {
  title: "Docs",
  description: "Judge quickstart, local setup, environment variables, the /api/v1 overview, and a Zapier recipe for turning Slack messages into SettleShort claims.",
};

const SAMPLES = ["coffee_shop_18_40.png", "team_dinner_186_50.png", "uber_24_00.pdf"];

const ENV: [string, string][] = [
  ["DATABASE_URL", "Postgres connection string. Required."],
  ["SESSION_SECRET", "Signs session cookies. Required. Use a long random string."],
  ["ANTHROPIC_API_KEY", "Optional. Reads receipts with Claude vision."],
  ["OPENAI_API_KEY", "Optional. Reads receipts with OpenAI vision. With neither key, on-device Tesseract OCR does real extraction, no key needed."],
  ["PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET", "Optional sandbox credentials. Without them, a clearly labelled payout simulator runs."],
  ["PAYPAL_WEBHOOK_ID", "Sandbox webhook ID, used to verify PayPal webhook signatures."],
  ["ZAPIER_WEBHOOK_SECRET", "Shared secret expected in the x-settleshort-secret header."],
  ["DEMO_PAYPAL_RECEIVERS", "Comma-separated sandbox personal accounts for the demo teammates."],
];

const API: [string, string, string][] = [
  ["POST", "/api/v1/claims/upload", "Upload a receipt image or PDF and extract a claim"],
  ["POST", "/api/v1/claims/from-text", "Create a claim from a natural-language message"],
  ["GET", "/api/v1/claims", "List claims in the workspace"],
  ["PATCH", "/api/v1/claims/:id", "Edit claim fields before approval"],
  ["POST", "/api/v1/claims/:id/reject", "Reject a claim"],
  ["POST", "/api/v1/claims/merge", "Merge a duplicate into its original"],
  ["POST", "/api/v1/batches", "Create a payout batch from ready claims"],
  ["POST", "/api/v1/batches/:id/approve", "Admin only. Requires typed APPROVE confirmation"],
  ["POST", "/api/v1/batches/:id/refresh-status", "Pull latest item statuses from PayPal"],
  ["GET", "/api/v1/batches/:id/export", "Download the batch as CSV"],
  ["POST", "/api/v1/webhooks/paypal", "PayPal Payouts webhook receiver"],
  ["POST", "/api/v1/webhooks/zapier", "Inbound messages from Zapier"],
  ["GET", "/api/v1/health", "Health check"],
];

const TOC = [
  ["quickstart", "Judge quickstart"],
  ["setup", "Local setup"],
  ["env", "Environment variables"],
  ["api", "API overview"],
  ["zapier", "Zapier recipe"],
];

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-[6px] bg-sunken px-1.5 py-0.5 font-mono text-[0.88em] text-ink">{children}</code>;
}

function Pre({ children, label }: { children: string; label: string }) {
  return (
    <pre aria-label={label} tabIndex={0} className="mt-4 overflow-x-auto rounded-[12px] border border-line bg-sunken p-4 font-mono text-[13px] leading-relaxed text-ink-2">
      {children}
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Task({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="border-l-2 border-line pl-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-1 text-muted">{children}</div>
    </li>
  );
}

export default function DocsPage() {
  return (
    <div className={`${wrap} grid gap-12 py-16 sm:py-24 lg:grid-cols-[200px_1fr]`}>
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-24 space-y-2.5 text-sm">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-muted hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 max-w-[760px] space-y-12">
        <header>
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[52px]">From receipt to payout.</h1>
          <p className="mt-4 text-lg text-ink-2">Everything runs in the PayPal sandbox. No real money moves.</p>
        </header>

        <Section id="quickstart" title="Judge quickstart">
          <ol className="space-y-8">
            <Task title="Open the demo">
              You are signed in as <strong className="text-ink">Maya</strong>, owner of the <strong className="text-ink">Northbeam Labs</strong> workspace, with sample
              claims already loaded.
              <div className="mt-4">
                <DemoLink />
              </div>
            </Task>
            <Task title="Create a claim">
              Open <strong className="text-ink">Claims</strong>, click <strong className="text-ink">New claim</strong>, and upload a sample receipt:
              <ul className="mt-3 flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <li key={s}>
                    <a href={`/demo/receipts/${s}`} className="inline-flex rounded-[8px] border border-line bg-panel px-2.5 py-1 font-mono text-xs text-accent hover:border-accent" download>
                      {s}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4">Or paste a message:</p>
              <Pre label="Example message">I paid $42.30 for Uber for @rita yesterday</Pre>
            </Task>
            <Task title="Approve a batch">
              Open <strong className="text-ink">Batches</strong>, then <strong className="text-ink">September offsites</strong>. Click{" "}
              <strong className="text-ink">Approve &amp; Pay</strong> and type <Code>APPROVE</Code> to confirm.
            </Task>
            <Task title="Watch it settle">
              Item statuses update as PayPal reports back (SUCCESS, UNCLAIMED, FAILED). <strong className="text-ink">Activity</strong> shows the full audit trail.
            </Task>
          </ol>
        </Section>

        <Section id="setup" title="Local setup">
          <p>Requires Node.js, pnpm and a Postgres database.</p>
          <Pre label="Setup commands">{`pnpm i
cp .env.example .env.local
pnpm db:migrate
pnpm dev`}</Pre>
        </Section>

        <Section id="env" title="Environment variables">
          <dl className="divide-y divide-line rounded-[12px] border border-line bg-panel">
            {ENV.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[260px_1fr] sm:gap-6">
                <dt className="break-words font-mono text-xs leading-6 text-ink">{k}</dt>
                <dd className="text-sm leading-6 text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="api" title="API overview">
          <p>
            All endpoints live under <Code>/api/v1</Code>, are scoped to the caller’s workspace, and return JSON.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-panel">
            {API.map(([m, p, d]) => (
              <li key={m + p} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex items-center gap-3">
                  <span className="w-14 font-mono text-[11px] font-semibold text-accent">{m}</span>
                  <span className="font-mono text-xs text-ink">{p}</span>
                </span>
                <span className="text-sm text-muted sm:ml-auto sm:text-right">{d}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="zapier" title="Zapier recipe">
          <p>
            Turn Slack messages into draft claims: trigger on a new message in a channel, then add a <strong className="text-ink">Webhooks by Zapier</strong> POST action.
          </p>
          <Pre label="Zapier webhook request">{`POST /api/v1/webhooks/zapier
x-settleshort-secret: <ZAPIER_WEBHOOK_SECRET>
content-type: application/json

{
  "workspace_slug": "<your-workspace-slug>",
  "text": "I paid $84 for dinner for @sam @rita",
  "from_email": "maya@northbeam.test"
}`}</Pre>
          <p className="mt-4 text-sm text-muted">Claims created this way still go through review and the admin approval gate.</p>
        </Section>
      </div>
    </div>
  );
}
