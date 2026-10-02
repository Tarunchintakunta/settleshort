import type { Metadata } from "next";
import { getImageProps } from "next/image";
import Link from "next/link";
import { ArrowDownIcon, CpuIcon, GitMergeIcon, GaugeIcon, PlusIcon, QuotesIcon } from "@phosphor-icons/react/ssr";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { DemoLink, wrap } from "@/components/marketing/Nav";
import { Reveal } from "@/components/marketing/Reveal";
import { Shot } from "@/components/marketing/Shot";

export const metadata: Metadata = {
  title: { absolute: "SettleShort: Receipt in. Settled out. One approve." },
  description:
    "SettleShort reads receipts and expense messages, catches duplicates, and pays your team through PayPal Payouts after an admin approves.",
};

const h2 = "text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[40px]";
const eyebrow = "text-[13px] font-medium uppercase tracking-[0.12em] text-accent";

const EVIDENCE = [
  {
    icon: QuotesIcon,
    title: "Quoted evidence",
    body: "Vendor, total and date each carry the exact line the reader saw, such as TOTAL $186.50.",
  },
  {
    icon: CpuIcon,
    title: "Your choice of reader",
    body: "On-device OCR with no key. Claude or OpenAI vision when you add one. The claim records which ran.",
  },
  {
    icon: GitMergeIcon,
    title: "Duplicates with a reason",
    body: "Deterministic rules compare amount, date and merchant. The warning explains the match in one line.",
  },
  {
    icon: GaugeIcon,
    title: "Low confidence slows down",
    body: "A shaky read goes to manual review instead of the next batch. Every field stays editable.",
  },
];

const GATE = [
  ["Admins only", "Members submit claims. Only owners and admins build and approve batches, checked on the server."],
  ["Hard caps", "Per-payout and per-batch limits are enforced before anything reaches PayPal."],
  ["One batch, one ID", "Each batch carries its own sender_batch_id, so a retry cannot pay anyone twice."],
  ["Everything logged", "Approvals, edits, merges and webhooks land in the audit log. Batches export to CSV."],
];

const PAYPAL = [
  ["Payouts API", "One POST /v1/payments/payouts per approved batch, with each teammate as an item."],
  ["OAuth 2.0 client credentials", "Tokens are minted on the server from your sandbox app. Secrets never reach the browser."],
  ["Webhooks", "Payout item events are checked with PayPal’s verify-webhook-signature API before any status changes."],
  ["Sandbox only", "The client refuses the live endpoint in code. Without keys, a labelled payout simulator runs."],
];

const PAYLOAD = `POST /v1/payments/payouts
PayPal-Request-Id: c4f672da-…

{
  "sender_batch_header": {
    "sender_batch_id": "c4f672da-…",
    "email_subject": "You were paid via SettleShort"
  },
  "items": [
    {
      "recipient_type": "EMAIL",
      "receiver": "dev@northbeam.test",
      "amount": { "value": "186.50", "currency": "USD" },
      "note": "#3 Nopa"
    }
  ]
}`;

const FAQ = [
  {
    q: "Is this real money?",
    a: "No. SettleShort only talks to the PayPal sandbox, and the code refuses to run against the live endpoint. Without sandbox keys, a payout simulator runs and every screen says so.",
  },
  {
    q: "Can the AI ever send money?",
    a: "No. AI reads receipts and drafts claims. Money moves only after an admin clicks Approve & Pay and types APPROVE to confirm.",
  },
  {
    q: "Which PayPal APIs does it use?",
    a: "Payouts for batch payments, OAuth 2.0 client credentials for server-side authentication, and webhooks, each verified with PayPal before a payout status changes.",
  },
  {
    q: "What if the extraction is wrong?",
    a: "Every field shows the text it was read from and can be edited before approval. Low-confidence claims go to manual review, and the raw model output is kept in the audit log.",
  },
  {
    q: "Does it work with Slack?",
    a: "Through Zapier today. A Zap posts Slack messages to SettleShort’s webhook and they become draft claims. A native Slack app is on the roadmap, along with Venmo and Hyperwallet payouts.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className={`${wrap} pt-14 sm:pt-20`}>
        <div className="max-w-[880px]">
          <h1 className="rise text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[60px] lg:text-[68px]">
            Receipt in. Settled out. <span className="text-accent sm:block">One approve.</span>
          </h1>
          <p className="rise mt-6 max-w-[540px] text-lg leading-relaxed text-ink-2" style={{ animationDelay: "60ms" }}>
            SettleShort reads receipts and expense messages, catches duplicates, and pays your team through PayPal after an admin approves.
          </p>
          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "120ms" }}>
            <DemoLink />
            <a
              href="#how"
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[8px] border border-line bg-panel px-5 text-[15px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken"
            >
              How it works <ArrowDownIcon size={16} aria-hidden />
            </a>
          </div>
        </div>
        <div className="rise mt-14 sm:mt-16" style={{ animationDelay: "180ms" }}>
          <Shot
            src="/marketing/extraction.png"
            alt="SettleShort reading a $186.50 Nopa receipt: each extracted field (vendor, total, date, tax, tip, card) sits beside the receipt with the quoted text it came from, and a warning says it is likely a duplicate of claim #3."
            sizes="(min-width: 1240px) 1152px, calc(100vw - 32px)"
            preload
            className="shadow-pop"
          />
        </div>
      </section>

      {/* Problem */}
      <section className={`${wrap} py-24 sm:py-32`} aria-labelledby="problem">
        <h2 id="problem" className="sr-only">
          Why paying people back is slow
        </h2>
        <Reveal>
          <p className="max-w-[920px] text-[24px] font-medium leading-[1.35] tracking-[-0.015em] text-ink sm:text-[32px]">
            After an offsite, receipts sit in camera rolls and Slack threads. Someone rebuilds them in a spreadsheet, the same dinner gets claimed twice, and the person
            tagged in passing never gets paid back.{" "}
            <span className="text-muted">
              Handing it to an agent that pays on its own does not fix that. It just moves the mistake closer to the money.
            </span>
          </p>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-y border-line bg-panel py-20 sm:py-24" aria-labelledby="how-title">
        <div className={wrap}>
          <p className={eyebrow}>How it works</p>
          <h2 id="how-title" className={`${h2} mt-3 max-w-[640px]`}>
            From a photo on someone’s phone to a paid teammate.
          </h2>
          <HowItWorks />
        </div>
      </section>

      {/* Extraction evidence */}
      <section className={`${wrap} py-24 sm:py-32`} aria-labelledby="evidence">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <Shot
              src="/marketing/extraction.png"
              alt="Close-up of the extracted claim: Vendor Nopa quoted as NOPA, total $186.50 quoted as TOTAL $186.50, date quoted as 09/26/2026 20:15, 85% confidence from local OCR, and an amber warning that it is likely a duplicate of claim #3."
              sizes="(min-width: 1024px) 460px, calc(100vw - 32px)"
              crop="aspect-[3/4] [&_img]:object-[100%_50%]"
            />
          </Reveal>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="evidence" className={h2}>
              Every number shows where it came from.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
              A reviewer should never have to trust a model. SettleShort puts the receipt text next to each field, so checking a claim takes seconds.
            </p>
            <dl className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {EVIDENCE.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <dt className="flex items-center gap-2.5 font-medium text-ink">
                    <Icon size={18} className="text-accent" aria-hidden />
                    {title}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Approval gate */}
      <section className="border-y border-line bg-sunken py-20 sm:py-28" aria-labelledby="gate">
        <div className={wrap}>
          <div className="max-w-[780px]">
            <h2 id="gate" className={h2}>
              Nothing is paid until a person types APPROVE.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
              AI reads, matches and drafts. It cannot pay. An admin reviews the batch, clicks Approve &amp; Pay, and types the word to confirm.
            </p>
          </div>
          <Reveal className="mt-12">
            <Shot
              src="/marketing/approve.png"
              alt="Confirmation dialog over a blurred batch page: Pay 3 people $287.55? It sends September offsites to PayPal Payouts, with a text field reading APPROVE and a green Approve & Pay $287.55 button."
              sizes="(min-width: 1240px) 1152px, calc(100vw - 32px)"
              crop="aspect-[16/10] lg:aspect-[21/9]"
            />
          </Reveal>
          <dl className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {GATE.map(([t, d]) => (
              <div key={t} className="border-t border-line-strong pt-5">
                <dt className="font-medium text-ink">{t}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* PayPal */}
      <section className={`${wrap} py-24 sm:py-32`} aria-labelledby="paypal">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <p className={eyebrow}>PayPal integration</p>
            <h2 id="paypal" className={`${h2} mt-3`}>
              Real PayPal APIs, held to the sandbox.
            </h2>
            <dl className="mt-10 space-y-7">
              {PAYPAL.map(([t, d]) => (
                <div key={t} className="grid gap-1.5 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <dt className="font-mono text-[13px] leading-6 text-ink">{t}</dt>
                  <dd className="text-sm leading-6 text-muted">{d}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-10 text-sm text-muted">On the roadmap, not built yet: Venmo payouts and Hyperwallet.</p>
          </div>
          <Reveal className="lg:col-span-6" delay={0.1}>
            <figure className="overflow-hidden rounded-[12px] border border-line bg-panel shadow-soft">
              <figcaption className="border-b border-line px-5 py-3 text-[13px] text-muted">What SettleShort sends when a batch is approved</figcaption>
              <pre tabIndex={0} aria-label="Example PayPal Payouts request" className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.7] text-ink-2">
                {PAYLOAD}
              </pre>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${wrap} border-t border-line py-24`} aria-labelledby="faq">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="faq" className={h2}>
              Questions
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              The <Link href="/security" className="text-accent underline-offset-4 hover:underline">security page</Link> and{" "}
              <Link href="/docs" className="text-accent underline-offset-4 hover:underline">docs</Link> go deeper.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line lg:col-span-8">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[8px] py-5 text-[17px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {q}
                  <PlusIcon size={18} className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className="max-w-[62ch] pb-6 text-[15px] leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={`${wrap} pb-24`}>
        <div className="grid overflow-hidden rounded-[12px] border border-line bg-panel shadow-soft lg:grid-cols-12">
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:col-span-5">
            <h2 className={h2}>Try it on a real receipt.</h2>
            <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-ink-2">
              The demo opens a sandbox workspace for Northbeam Labs with sample claims. No signup.
            </p>
            <DemoLink className="mt-8 self-start" />
          </div>
          <div className="relative min-h-[280px] border-t border-line lg:col-span-7 lg:min-h-[420px] lg:border-t-0 lg:border-l">
            <DashboardPicture />
          </div>
        </div>
      </section>
    </>
  );
}

/** Light or dark dashboard, following the same prefers-color-scheme switch as the design tokens. */
function DashboardPicture() {
  const common = { fill: true, sizes: "(min-width: 1024px) 680px, 100vw", alt: "SettleShort overview for Northbeam Labs with one batch awaiting approval, open claims, and recent activity." };
  const { props: dark } = getImageProps({ ...common, src: "/marketing/dashboard-dark.png" });
  const { props: light } = getImageProps({ ...common, src: "/marketing/dashboard.png" });
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark.srcSet} sizes={dark.sizes} />
      <img {...light} alt={common.alt} className="object-cover object-left-top" />
    </picture>
  );
}
