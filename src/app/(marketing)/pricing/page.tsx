import type { Metadata } from "next";
import { CheckIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { DemoLink, wrap } from "@/components/marketing/Nav";
import { Button, cx, Pill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "SettleShort is free to try as a hackathon demo. A Team plan comes later.",
};

const FREE = ["Receipt and message intake with quoted evidence", "Duplicate matching with a one-line reason", "PayPal Payouts in sandbox", "Approval gate, caps and audit log", "MIT-licensed source"];
const TEAM = ["Everything in Free", "Live PayPal payouts", "Native Slack app (roadmap)", "Venmo and Hyperwallet (roadmap)"];

function Plan({ id, name, tag, price, blurb, items, cta, hero }: { id: string; name: string; tag: string; price: ReactNode; blurb: string; items: string[]; cta: ReactNode; hero?: boolean }) {
  return (
    <section
      aria-labelledby={id}
      className={cx(
        "flex flex-col rounded-[12px] border bg-panel p-8 sm:p-10",
        hero ? "border-accent shadow-soft ring-4 ring-accent/10" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className={cx("text-lg font-semibold tracking-[-0.02em]", hero ? "text-ink" : "text-ink-2")}>
          {name}
        </h2>
        <Pill tone={hero ? "accent" : "neutral"}>{tag}</Pill>
      </div>
      <div className="mt-8">{price}</div>
      <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">{blurb}</p>
      <Points items={items} muted={!hero} />
      <div className="mt-auto pt-10">{cta}</div>
    </section>
  );
}

function Points({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="mt-8 space-y-3 border-t border-line pt-8 text-[15px]">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-ink-2">
          <CheckIcon size={18} className={cx("mt-0.5 shrink-0", muted ? "text-muted" : "text-success")} aria-hidden /> {t}
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
      <div className="mt-14 grid items-stretch gap-5 md:grid-cols-2">
        <Plan
          id="free"
          name="Free"
          tag="Hackathon demo"
          price={<p className="money text-[56px] font-semibold leading-none text-ink sm:text-[64px]">$0</p>}
          blurb="The whole product, running against the PayPal sandbox. No card, and no signup for the demo."
          items={FREE}
          cta={<DemoLink className="w-full sm:w-auto" />}
          hero
        />
        <Plan
          id="team"
          name="Team"
          tag="Later"
          price={<p className="flex h-[56px] items-end text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink-2 sm:h-[64px]">Not priced yet</p>}
          blurb="For teams settling real expenses. Pricing comes once live payouts are supported."
          items={TEAM}
          cta={
            <Button variant="secondary" disabled className="h-11 w-full px-5 text-[15px] sm:w-auto">
              Coming soon
            </Button>
          }
        />
      </div>
    </div>
  );
}
