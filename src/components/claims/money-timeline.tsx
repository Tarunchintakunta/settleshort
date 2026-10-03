import { CheckIcon } from "@phosphor-icons/react/ssr";
import { cx, Pill } from "@/components/ui";
import type { Step, Truth } from "@/lib/status";

/** "Where's my money": the truthful status plus every step with its timestamp, like a package tracker. */
export function MoneyTimeline({ truth, steps, children }: { truth: Truth; steps: Step[]; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="wheres-h" className="rounded-[12px] border border-line bg-panel p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="wheres-h" className="text-[15px] font-semibold tracking-[-0.015em]">
          Where&apos;s the money
        </h2>
        <Pill tone={truth.tone} dot>
          {truth.label}
        </Pill>
      </div>
      {truth.detail && <p className="mt-1.5 text-[13px] text-ink-2">{truth.detail}</p>}
      <ol className="mt-4">
        {steps.map((t, i) => (
          <li key={t.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className={cx("absolute top-5 left-[9px] h-[calc(100%-12px)] w-px", t.done ? "bg-success/50" : "bg-line")} aria-hidden />}
            <span
              className={cx(
                "relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                t.done ? "border-success bg-success text-on-success" : "border-line-strong bg-panel text-transparent",
              )}
              aria-hidden
            >
              <CheckIcon className="size-3" weight="bold" />
            </span>
            <div>
              <p className={cx("text-sm", t.done ? "font-medium" : "text-muted")}>{t.label}</p>
              {t.at && <p className="tnum text-xs text-muted">{t.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}
            </div>
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}
