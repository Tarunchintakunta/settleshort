import type { Metadata } from "next";
import { CheckIcon } from "@phosphor-icons/react/ssr";
import { DemoLink, wrap } from "@/components/marketing/Nav";

export const metadata: Metadata = {
  title: "Pricing",
  description: "SettleShort is free to try as a hackathon demo. A Team plan comes later.",
};

const FREE = ["Receipt and message intake with quoted evidence", "Duplicate matching with a one-line reason", "PayPal Payouts in sandbox", "Approval gate, caps and audit log", "MIT-licensed source"];
const TEAM = ["Everything in Free", "Live PayPal payouts", "Native Slack app (roadmap)", "Venmo and Hyperwallet (roadmap)"];

function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 space-y-3 text-[15px]">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-ink-2">
          <CheckIcon size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <div className={`${wrap} py-16 sm:py-24`}>
      <header className="max-w-[640px]">
        <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[56px]">Free while we build.</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">SettleShort is a hackathon project. There is nothing to buy today.</p>
      </header>
      <div className="mt-16 grid items-start gap-4 lg:grid-cols-12">
        <section aria-labelledby="free" className="flex flex-col rounded-[12px] border border-line bg-panel p-8 shadow-pop sm:p-10 lg:col-span-7 lg:p-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="free" className="text-lg font-semibold tracking-[-0.02em] text-ink">
              Free
            </h2>
            <span className="text-sm text-muted">Hackathon demo</span>
          </div>
          <p className="money mt-8 text-[64px] font-semibold leading-none text-ink sm:text-[72px]">$0</p>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">The whole product, running against the PayPal sandbox. No card, and no signup for the demo.</p>
          <Points items={FREE} />
          <DemoLink className="mt-10 self-start" />
        </section>
        <section aria-labelledby="team" className="flex flex-col rounded-[12px] border border-line bg-sunken p-8 sm:p-10 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="team" className="text-lg font-semibold tracking-[-0.02em] text-muted">
              Team
            </h2>
            <span className="text-sm text-muted">Later</span>
          </div>
          <p className="mt-8 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink-2">Not priced yet</p>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">For teams settling real expenses. Pricing comes once live payouts are supported.</p>
          <Points items={TEAM} />
        </section>
      </div>
    </div>
  );
}
