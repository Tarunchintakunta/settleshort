import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "approve" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(26_69_232/0.28)]",
  secondary: "bg-panel text-ink border border-line shadow-[0_1px_0_rgb(255_255_255/0.5)] hover:border-line-strong hover:bg-sunken",
  approve:
    "bg-success text-on-success hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.24),0_1px_2px_rgb(13_122_76/0.35)]",
  danger: "bg-panel text-danger border border-danger/30 hover:bg-danger-soft",
  ghost: "text-muted hover:text-ink hover:bg-sunken",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-[8px] px-4 h-10 text-sm font-medium tracking-[-0.011em] transition-[background,border,color,box-shadow,transform,filter] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none";

type BtnProps = { variant?: Variant; size?: "sm" | "lg" };
const sizeCls = (s?: "sm" | "lg") => (s === "sm" ? "h-8 px-3 text-[13px]" : s === "lg" ? "h-12 px-6 text-[15px]" : "");

export function Button({ variant = "primary", size, className, ...p }: ComponentProps<"button"> & BtnProps) {
  return <button className={cx(base, VARIANTS[variant], sizeCls(size), className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size, className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cx(base, VARIANTS[variant], sizeCls(size), className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-[12px] border border-line bg-panel shadow-soft", className)} {...p} />;
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};
const STATUS: Record<string, [Tone, string]> = {
  draft: ["neutral", "Draft"],
  pending_review: ["warning", "Needs review"],
  matched: ["accent", "Approved"],
  in_batch: ["neutral", "In batch"],
  paid: ["success", "Paid"],
  failed: ["danger", "Failed"],
  rejected: ["neutral", "Rejected"],
  awaiting_approval: ["warning", "Awaiting approval"],
  submitting: ["accent", "Submitting"],
  unknown: ["warning", "Verifying with PayPal"],
  submitted: ["accent", "Processing"],
  completed: ["success", "Paid"],
  partial: ["warning", "Partially paid"],
  NEW: ["neutral", "Not sent"],
  PENDING: ["accent", "Pending"],
  SUCCESS: ["success", "Paid"],
  UNCLAIMED: ["warning", "Unclaimed"],
  FAILED: ["danger", "Failed"],
};

export function Pill({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tracking-[-0.01em] whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className={cx("size-1.5 shrink-0 rounded-full", DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const [tone, label] = STATUS[status] ?? ["neutral", status.replace(/_/g, " ")];
  return (
    <Pill tone={tone} dot>
      {label}
    </Pill>
  );
}

export const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI",
  local: "Local OCR",
  parser: "Rules parser",
  simulator: "Sample data",
};

/** Confidence as a compact meter + number. Low confidence reads as a warning. */
export function Confidence({ value, provider, className }: { value: number | null | undefined; provider?: string; className?: string }) {
  if (value == null) return <span className="text-xs text-muted">Manual entry</span>;
  const pct = Math.round(value * 100);
  const low = value < 0.55;
  return (
    <span className={cx("inline-flex items-center gap-2 text-xs", className)} title={`Extracted by ${PROVIDER_LABEL[provider ?? ""] ?? "AI"}`}>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={cx("absolute inset-y-0 left-0 rounded-full", low ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </span>
      <span className={cx("tnum font-mono", low ? "font-medium text-warning" : "text-ink")}>{pct}%</span>
      {provider && <span className="text-muted">{PROVIDER_LABEL[provider] ?? provider}</span>}
    </span>
  );
}

export function Money({ cents, currency, className }: { cents: number; currency: string; className?: string }) {
  return <span className={cx("money", className)}>{formatMoney(cents, currency)}</span>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-[-0.03em] text-ink", className)}>
      <svg viewBox="0 0 24 24" className="size-[22px] shrink-0" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--accent)" />
        <path d="M7.1 12.4 10.3 15.6 16.9 8.7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      SettleShort
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-dashed border-line-strong bg-panel px-6 py-20 text-center">
      {icon && <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-line bg-sunken text-muted">{icon}</div>}
      <p className="text-[15px] font-semibold tracking-[-0.015em]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium tracking-[-0.011em] text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs leading-relaxed text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-[8px] border border-line bg-panel px-3 text-sm text-ink shadow-[inset_0_1px_2px_rgb(18_18_20/0.04)] placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:bg-sunken disabled:text-muted";

const ALERT_EDGE: Record<"danger" | "success" | "warning", string> = {
  danger: "border border-danger/20",
  success: "border border-success/20",
  warning: "border border-warning/30",
};

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "warning"; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[8px] px-3.5 py-2.5 text-sm leading-relaxed", TONES[tone], ALERT_EDGE[tone])}>
      {children}
    </div>
  );
}

/** Shared filter / mode tabs. Presentation only. */
export const tabTrack = "inline-flex max-w-full flex-wrap gap-0.5 rounded-[10px] bg-sunken p-1";
export function tabBtn(on: boolean) {
  return cx(
    "rounded-[7px] px-3 py-1.5 text-[13px] transition-colors duration-200",
    on ? "bg-panel font-medium text-ink shadow-soft" : "text-muted hover:text-ink",
  );
}
