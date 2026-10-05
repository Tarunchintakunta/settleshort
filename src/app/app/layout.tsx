import Link from "next/link";
import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { logout } from "@/app/(auth)/actions";
import { MobileNav, SideNav, WorkspaceLabel } from "@/components/app/sidebar";
import { cx, Logo, PROVIDER_LABEL } from "@/components/ui";
import { aiProvider } from "@/lib/ai";
import { requirePageCtx } from "@/lib/auth";
import { paypalMode } from "@/lib/paypal";
import { workspaceExceptions } from "@/lib/exceptions";
import { navCounts } from "@/lib/nav-counts";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await requirePageCtx();
  const [counts, exceptions] = await Promise.all([
    navCounts(ctx.workspace.id, ctx.user.id),
    // ponytail: recomputed per page load; cache or count in SQL once workspaces have thousands of open claims.
    ctx.isAdmin ? workspaceExceptions(ctx.workspace) : Promise.resolve([]),
  ]);
  const allCounts = { ...counts, "/app/exceptions": exceptions.length };
  const hide = ctx.isAdmin ? [] : ["/app/exceptions", "/app/exports"];
  const wsLabel = `${ctx.workspace.name}${ctx.workspace.isDemo ? " · demo" : ""}`;
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-line px-3 py-2 md:sticky md:top-0 md:h-[100dvh] md:w-[244px] md:shrink-0 md:gap-5 md:border-b-0 md:px-3 md:py-5">
        <div className="flex items-center justify-between gap-3 px-1 md:px-2">
          <Link href="/app" aria-label="Overview" className="min-w-0">
            <Logo />
          </Link>
          <div className="flex min-w-0 md:hidden">
            <WorkspaceLabel name={wsLabel} />
          </div>
        </div>
        <div className="hidden items-center gap-2.5 rounded-[12px] border border-line bg-panel p-2.5 shadow-soft md:flex">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-ink font-mono text-sm font-semibold text-panel" aria-hidden>
            {ctx.workspace.name[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium tracking-[-0.011em]">{ctx.workspace.name}</p>
            <p className="truncate text-xs capitalize text-muted">
              {ctx.role}
              {ctx.workspace.isDemo ? " · demo" : ""}
            </p>
          </div>
        </div>
        <SideNav counts={allCounts} hide={hide} />
        <div className="hidden shrink-0 space-y-3 md:block">
          <div className="space-y-2.5 rounded-[12px] border border-line bg-panel p-3 text-xs shadow-soft">
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">System</p>
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted">
                <span className={cx("size-1.5 rounded-full", pp === "sandbox" ? "bg-success" : "bg-warning")} aria-hidden />
                PayPal
              </span>
              <span className={cx("font-medium", pp === "sandbox" ? "text-success" : "text-warning")}>{pp === "sandbox" ? "Sandbox" : "Simulator"}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Extraction
              </span>
              <span className="font-medium text-ink-2">{PROVIDER_LABEL[ai]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 px-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold text-ink" aria-hidden>
              {ctx.user.name[0]}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{ctx.user.name}</span>
            <form action={logout}>
              <button className="flex size-9 items-center justify-center rounded-[8px] text-muted hover:bg-panel hover:text-ink" aria-label="Sign out" title="Sign out">
                <SignOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <MobileNav counts={allCounts} hide={hide} userName={ctx.user.name} />
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:py-2 md:pr-2 md:pb-2">
        <div className="min-h-full bg-panel px-4 py-7 sm:px-6 md:min-h-[calc(100dvh-16px)] md:rounded-[12px] md:border md:border-line md:px-10 md:py-10 md:shadow-soft">
          {ctx.workspace.isDemo ? (
            <p className="mx-auto mb-8 flex max-w-[1100px] items-start gap-2.5 rounded-[10px] border border-accent/25 bg-accent-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <b className="font-medium text-ink">Demo workspace.</b> The company, people and claims are sample data, separate from every real workspace, and deleted after a day.{" "}
                <Link href="/signup" className="font-medium text-accent underline underline-offset-2">
                  Create your own workspace
                </Link>
              </span>
            </p>
          ) : null}
          {pp !== "sandbox" && (
            <p className="mx-auto mb-8 flex max-w-[1100px] items-start gap-2.5 rounded-[10px] border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
              <span>
                PayPal simulator active. Add <span className="font-mono">PAYPAL_CLIENT_ID</span> and <span className="font-mono">PAYPAL_CLIENT_SECRET</span> to send real sandbox payouts. No real money moves in either mode.
              </span>
            </p>
          )}
          <div className="mx-auto max-w-[1100px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
