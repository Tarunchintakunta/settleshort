"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { CameraIcon, GitMergeIcon, ScanIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { cx } from "@/components/ui";

const STEPS = [
  {
    id: "capture",
    verb: "Capture",
    icon: CameraIcon,
    body: "Upload a receipt photo or PDF, or forward the message. “I paid $84 for dinner for @sam @rita” works as written.",
    src: "/marketing/claims.png",
    alt: "SettleShort claims list for Northbeam Labs: nine claims with date, vendor, amount, who paid, source (Upload, Slack or Manual), extraction confidence and status.",
  },
  {
    id: "read",
    verb: "Read",
    icon: ScanIcon,
    body: "On-device OCR reads it, or Claude or OpenAI vision when a key is set. Each field shows the text it came from.",
    src: "/marketing/extraction.png",
    alt: "New claim screen: a Nopa restaurant receipt on the left, and on the right the extracted vendor, total of $186.50 and date, each with the quoted receipt text underneath.",
  },
  {
    id: "match",
    verb: "Match",
    icon: GitMergeIcon,
    body: "Plain rules compare amount, date and merchant with existing claims. Look-alikes wait in review with a one-line reason.",
    src: "/marketing/dashboard.png",
    alt: "Overview dashboard: a September offsites batch of $287.55 awaiting approval, and a Needs review list flagging a possible duplicate and a low-confidence extraction.",
  },
  {
    id: "approve",
    verb: "Approve",
    icon: ShieldCheckIcon,
    body: "An admin approves the batch once. PayPal Payouts pays each teammate and webhooks report every result.",
    src: "/marketing/paid.png",
    alt: "September offsites batch after payout: three recipients marked Paid with PayPal transaction IDs, and a timeline from batch created to approved by a human to paid.",
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent) {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (active + d + STEPS.length) % STEPS.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="mt-12 grid min-w-0 gap-8 lg:grid-cols-12 lg:gap-12">
      <div role="tablist" aria-label="How SettleShort works" aria-orientation="vertical" onKeyDown={onKey} className="flex flex-col gap-1 lg:col-span-4">
        {STEPS.map(({ id, verb, icon: Icon, body }, i) => {
          const on = i === active;
          return (
            <button
              key={id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`panel-${id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={cx(
                "group relative rounded-[12px] border px-4 py-4 text-left transition-[background,border,box-shadow] duration-200",
                on ? "border-line bg-bg shadow-soft" : "border-transparent hover:bg-bg/70",
              )}
            >
              <span className={cx("absolute top-4 bottom-4 left-0 w-0.5 rounded-full", on ? "bg-accent" : "bg-transparent")} aria-hidden />
              <span className="flex items-center gap-3">
                <Icon size={20} weight={on ? "fill" : "regular"} className={on ? "text-accent" : "text-muted"} aria-hidden />
                <span className={cx("text-[17px] font-semibold tracking-[-0.02em]", on ? "text-ink" : "text-ink-2")}>{verb}</span>
              </span>
              <span className={cx("mt-2 block pl-8 text-sm leading-relaxed", on ? "text-ink-2" : "text-muted")}>{body}</span>
            </button>
          );
        })}
      </div>
      <div className="lg:col-span-8">
        <div className="rounded-[12px] border border-line bg-sunken p-1.5 shadow-soft sm:p-2">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[8px] bg-panel">
            {STEPS.map(({ id, src, alt }, i) => (
              <div
                key={id}
                id={`panel-${id}`}
                role="tabpanel"
                aria-labelledby={`tab-${id}`}
                aria-hidden={i !== active}
                className={cx(
                  "absolute inset-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  i === active ? "z-10 translate-y-0 opacity-100" : "pointer-events-none z-0 translate-y-2 opacity-0",
                )}
              >
                <Image src={src} alt={alt} fill sizes="(min-width: 1200px) 760px, (min-width: 1024px) 64vw, 100vw" className="object-cover object-left-top" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
