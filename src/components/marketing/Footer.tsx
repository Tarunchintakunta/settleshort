import Link from "next/link";
import { Logo } from "@/components/ui";
import { wrap } from "./Nav";

const COLS: [string, [string, string][]][] = [
  ["Product", [["/#how", "How it works"], ["/security", "Security"], ["/pricing", "Pricing"]]],
  ["Resources", [["/docs", "Docs"], ["https://github.com/Tarunchintakunta/settleshort", "GitHub"]]],
  ["Account", [["/login", "Sign in"], ["/demo", "Open the demo"]]],
];

const linkCls = "text-sm text-muted transition-colors hover:text-ink";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className={`${wrap} grid gap-10 py-14 md:grid-cols-12 md:py-16`}>
        <div className="md:col-span-6">
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] tracking-[-0.015em] text-ink-2">Receipt in. Settled out. One approve.</p>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-muted">
            Built for Build What&rsquo;s Next with PayPal and AI, 2026. MIT license. Sandbox only, no real money moves.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:col-span-6">
          {COLS.map(([title, links]) => (
            <div key={title}>
              <p className="text-[11px] font-medium tracking-[0.14em] text-ink uppercase">{title}</p>
              <ul className="mt-4 space-y-2.5">
                {links.map(([href, label]) => (
                  <li key={href}>
                    {href.startsWith("http") ? (
                      <a href={href} className={linkCls} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    ) : href === "/demo" ? (
                      // Plain <a>: /demo creates a workspace and must never be prefetched.
                      <a href={href} className={linkCls}>
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className={linkCls}>
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
