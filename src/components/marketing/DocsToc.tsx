"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

export const DOCS_TOC = [
  ["quickstart", "Judge quickstart"],
  ["setup", "Local setup"],
  ["env", "Environment variables"],
  ["api", "API overview"],
  ["zapier", "Zapier recipe"],
] as const;

export function DocsToc() {
  const [active, setActive] = useState<string>(DOCS_TOC[0][0]);

  useEffect(() => {
    const els = DOCS_TOC.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const next = visible[0]?.target.id;
        if (next) setActive(next);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: [0, 0.2, 0.6] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="On this page" className="sticky top-24 hidden self-start lg:block">
      <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">On this page</p>
      <ul className="space-y-0.5">
        {DOCS_TOC.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              className={cx(
                "block border-l-2 py-1.5 pl-3 text-sm transition-colors",
                active === id ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
