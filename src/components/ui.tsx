import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "approve" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
  secondary: "bg-panel text-ink border border-line hover:border-line-strong hover:bg-sunken",
  approve: "bg-success text-white hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]",
  danger: "bg-panel text-danger border border-line hover:bg-danger-soft",
  ghost: "text-muted hover:text-ink hover:bg-sunken",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-[8px] px-4 h-10 text-sm font-medium transition-[background,border,color,transform,filter] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none";

type BtnProps = { variant?: Variant; size?: "sm" | "lg" };
const sizeCls = (s?: "sm" | "lg") => (s === "sm" ? "h-8 px-3 text-[13px]" : s === "lg" ? "h-12 px-6 text-[15px]" : "");

export function Button({ variant = "primary", size, className, ...p }: ComponentProps<"button"> & BtnProps) {
  return <button className={cx(base, VARIANTS[variant], sizeCls(size), className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size, className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={cx(base, VARIANTS[variant], sizeCls(size), className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-[12px] border border-line bg-panel", className)} {...p} />;
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
const STATUS: Record<string, [Tone, string]> = {
  draft: ["neutral", "Draft"],
  pending_review: ["warning", "Needs review"],
  matched: ["accent", "Ready"],
  in_batch: ["neutral", "In batch"],
  paid: ["success", "Paid"],
  failed: ["danger", "Failed"],
  rejected: ["neutral", "Rejected"],
  awaiting_approval: ["warning", "Awaiting approval"],
  submitting: ["accent", "Submitting"],
  submitted: ["accent", "Processing"],
  completed: ["success", "Paid"],
  partial: ["warning", "Partially paid"],
  NEW: ["neutral", "Not sent"],
  PENDING: ["accent", "Pending"],
  SUCCESS: ["success", "Paid"],
  UNCLAIMED: ["warning", "Unclaimed"],
  FAILED: ["danger", "Failed"],
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const [tone, label] = STATUS[status] ?? ["neutral", status.replace(/_/g, " ")];
  return <Pill tone={tone}>{label}</Pill>;
}

export const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI",
  local: "Local OCR",
  simulator: "Sample data",
};

/** Confidence as a compact meter + number. Low confidence reads as a warning. */
export function Confidence({ value, provider, className }: { value: number | null | undefined; provider?: string; className?: string }) {
  if (value == null) return <span className="text-xs text-muted">Manual entry</span>;
  const pct = Math.round(value * 100);
  const low = value < 0.55;
  return (
    <span className={cx("inline-flex items-center gap-2 text-xs", className)} title={`Extracted by ${PROVIDER_LABEL[provider ?? ""] ?? "AI"}`}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className={cx("absolute inset-y-0 left-0 rounded-full", low ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </span>
      <span className={cx("tnum font-mono", low ? "text-warning" : "text-ink-2")}>{pct}%</span>
      {provider && <span className="text-muted">{PROVIDER_LABEL[provider] ?? provider}</span>}
    </span>
  );
}

export function Money({ cents, currency, className }: { cents: number; currency: string; className?: string }) {
  return <span className={cx("tnum", className)}>{formatMoney(cents, currency)}</span>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--accent)" />
        <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      SettleShort
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
        {sub && <p className="mt-1 max-w-[60ch] text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-dashed border-line-strong px-6 py-16 text-center">
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-sunken text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-[8px] border border-line bg-panel px-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:bg-sunken disabled:text-muted";

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "warning"; children: ReactNode }) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[8px] px-3 py-2 text-sm", TONES[tone])}>
      {children}
    </p>
  );
}
