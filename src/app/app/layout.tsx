import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { logout } from "@/app/(auth)/actions";
import { SideNav } from "@/components/app/sidebar";
import { cx, Logo, PROVIDER_LABEL } from "@/components/ui";
import { aiProvider } from "@/lib/ai";
import { requirePageCtx } from "@/lib/auth";
import { batches, claims, db } from "@/lib/db";
import { paypalMode } from "@/lib/paypal";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await requirePageCtx();
  const [[review], [awaiting]] = await Promise.all([
    db.select({ n: count() }).from(claims).where(and(eq(claims.workspaceId, ctx.workspace.id), eq(claims.status, "pending_review"))),
    db.select({ n: count() }).from(batches).where(and(eq(batches.workspaceId, ctx.workspace.id), eq(batches.status, "awaiting_approval"))),
  ]);
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-5 border-b border-line px-4 py-4 md:sticky md:top-0 md:h-[100dvh] md:w-[244px] md:shrink-0 md:border-b-0 md:px-3 md:py-5">
        <div className="flex items-center justify-between md:px-2">
          <Link href="/app" aria-label="Overview">
            <Logo />
          </Link>
        </div>
        <div className="hidden items-center gap-2.5 rounded-[10px] border border-line bg-panel p-2.5 md:flex">
          <span className="flex size-8 items-center justify-center rounded-[8px] bg-ink text-sm font-semibold text-panel" aria-hidden>
            {ctx.workspace.name[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{ctx.workspace.name}</p>
            <p className="truncate text-xs capitalize text-muted">
              {ctx.role}
              {ctx.workspace.isDemo ? " · demo" : ""}
            </p>
          </div>
        </div>
        <SideNav counts={{ "/app/claims": review.n, "/app/batches": awaiting.n }} />
        <div className="mt-auto hidden space-y-3 md:block">
          <div className="space-y-2 rounded-[10px] border border-line bg-panel p-3 text-xs">
            <p className="flex items-center justify-between">
              <span className="text-muted">PayPal</span>
              <span className={cx("font-medium", pp === "sandbox" ? "text-success" : "text-warning")}>{pp === "sandbox" ? "Sandbox" : "Simulator"}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted">Extraction</span>
              <span className="font-medium text-ink-2">{PROVIDER_LABEL[ai]}</span>
            </p>
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="truncate text-[13px] text-ink-2">{ctx.user.name}</span>
            <form action={logout}>
              <button className="rounded-[6px] p-1.5 text-muted hover:bg-panel hover:text-ink" aria-label="Sign out" title="Sign out">
                <SignOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:py-2 md:pr-2">
        <div className="min-h-full bg-panel px-4 py-8 md:min-h-[calc(100dvh-16px)] md:rounded-[14px] md:border md:border-line md:px-10 md:py-10">
          {pp !== "sandbox" && (
            <p className="mx-auto mb-6 max-w-[1100px] rounded-[8px] bg-sunken px-3 py-2 text-xs text-ink-2">
              PayPal simulator active. Add <span className="font-mono">PAYPAL_CLIENT_ID</span> and <span className="font-mono">PAYPAL_CLIENT_SECRET</span> to send real sandbox payouts. No real money moves in either mode.
            </p>
          )}
          <div className="mx-auto max-w-[1100px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
