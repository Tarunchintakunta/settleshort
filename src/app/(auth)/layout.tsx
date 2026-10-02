import Link from "next/link";
import { Card, Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-[100dvh] flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <aside className="hidden overflow-hidden border-r border-line bg-sunken lg:flex lg:flex-col lg:px-12 lg:py-10">
        <Link href="/" aria-label="SettleShort home">
          <Logo />
        </Link>
        <div className="mt-16 max-w-[440px]">
          <p className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">Receipt in. Settled out. One approve.</p>
          <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-ink-2">
            The settlement desk. Receipts and messages become claims. Money moves only after a person approves.
          </p>
          <p className="mt-6 text-xs text-muted">PayPal sandbox only. No real money moves.</p>
        </div>
        <div className="mt-auto w-[108%] max-w-none translate-x-6 pt-12" aria-hidden>
          <div className="overflow-hidden rounded-[12px] border border-line shadow-pop">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/marketing/dashboard-dark.png" />
              <img src="/marketing/dashboard.png" alt="" className="h-auto w-full" />
            </picture>
          </div>
        </div>
      </aside>
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <Link href="/" className="mb-8 lg:hidden" aria-label="SettleShort home">
          <Logo className="text-lg" />
        </Link>
        <Card className="rise w-full max-w-[420px] p-8 sm:p-9">{children}</Card>
        <p className="mt-6 text-center text-sm text-muted">
          Just looking?{" "}
          <a href="/demo" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Open the demo workspace
          </a>
        </p>
      </div>
    </main>
  );
}
