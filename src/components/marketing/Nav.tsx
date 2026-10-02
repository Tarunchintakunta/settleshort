import Link from "next/link";
import { ListIcon } from "@phosphor-icons/react/ssr";
import { cx, Logo } from "@/components/ui";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export const wrap = "mx-auto w-full min-w-0 max-w-[1200px] px-4 sm:px-6";

/** Plain <a>: /demo is a route handler that creates a workspace, so it must never be prefetched by next/link. */
export function DemoLink({ className, size }: { className?: string; size?: "sm" }) {
  return (
    <a
      href="/demo"
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[8px] bg-accent font-medium tracking-[-0.011em] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(26_69_232/0.28)] transition-[background,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-hover active:scale-[0.98]",
        size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-[15px]",
        className,
      )}
    >
      Open the demo
    </a>
  );
}

const linkCls = "rounded-[8px] px-3 py-2 text-sm text-muted transition-colors hover:text-ink";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-xl">
      <nav aria-label="Main" className={cx(wrap, "flex h-16 items-center justify-between gap-6")}>
        <Link href="/" aria-label="SettleShort home" className="rounded-[8px]">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkCls}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={linkCls}>
            Sign in
          </Link>
          <DemoLink size="sm" />
        </div>
        <details className="group relative md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-[8px] border border-line bg-panel [&::-webkit-details-marker]:hidden">
            <ListIcon size={20} aria-hidden />
            <span className="sr-only">Menu</span>
          </summary>
          <div className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-[12px] border border-line bg-panel p-2 shadow-pop">
            {[...LINKS, { href: "/login", label: "Sign in" }].map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-[8px] px-3 py-2.5 text-sm text-ink hover:bg-sunken">
                {l.label}
              </Link>
            ))}
            <DemoLink size="sm" className="mt-2 w-full" />
          </div>
        </details>
      </nav>
    </header>
  );
}
