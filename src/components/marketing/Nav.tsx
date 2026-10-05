import Link from "next/link";
import { cx, Logo } from "@/components/ui";
import { MobileMenu } from "./MobileMenu";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export const wrap = "mx-auto w-full min-w-0 max-w-[1200px] px-4 sm:px-6";

/** Plain <a>: /demo is a route handler that creates a workspace, so it must never be prefetched by next/link. */
export function DemoLink({ className, size, label = "Open the demo" }: { className?: string; size?: "sm"; label?: string }) {
  return (
    <a
      href="/demo"
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[8px] bg-accent font-medium tracking-[-0.011em] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(26_69_232/0.28)] transition-[background,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-hover active:scale-[0.98]",
        size === "sm" ? "h-11 px-3.5 text-sm md:h-9" : "h-11 px-5 text-[15px]",
        className,
      )}
    >
      {label}
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
        <div className="flex items-center gap-2 md:hidden">
          {/* Sticky header CTA on phones too: the demo is always one tap away. */}
          <DemoLink size="sm" label="Try it" />
          <MobileMenu links={[...LINKS, { href: "/login", label: "Sign in" }]} demo={<DemoLink size="sm" className="w-full" />} />
        </div>
      </nav>
    </header>
  );
}
