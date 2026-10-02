import Link from "next/link";
import { Logo } from "@/components/ui";
import { wrap } from "./Nav";

const LINKS: [string, string][] = [
  ["/#how", "How it works"],
  ["/security", "Security"],
  ["/pricing", "Pricing"],
  ["/docs", "Docs"],
  ["/login", "Sign in"],
  ["https://github.com/Tarunchintakunta/settleshort", "GitHub"],
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className={`${wrap} flex flex-col gap-10 py-14 md:flex-row md:items-start md:justify-between md:py-16`}>
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] tracking-[-0.015em] text-ink-2">Receipt in. Settled out. One approve.</p>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-muted">
            Built for Build What&rsquo;s Next with PayPal and AI, 2026. MIT license. Sandbox only, no real money moves.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:grid-cols-3">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              {href.startsWith("http") ? (
                <a href={href} className="text-sm text-muted hover:text-ink" target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ) : (
                <Link href={href} className="text-sm text-muted hover:text-ink">
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
