"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";

export function MobileMenu({ links, demo }: { links: { href: string; label: string }[]; demo: React.ReactNode }) {
  const path = usePathname();
  // Open only on the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (o: boolean | ((o: boolean) => boolean)) => setOpenAt((typeof o === "function" ? o(open) : o) ? path : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-[8px] border border-line bg-panel"
      >
        {open ? <XIcon size={20} aria-hidden /> : <ListIcon size={20} aria-hidden />}
      </button>
      <div id="mobile-menu" hidden={!open} className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-[12px] border border-line bg-panel p-2 shadow-pop">
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-[8px] px-3 py-3 text-sm text-ink hover:bg-sunken">
            {l.label}
          </Link>
        ))}
        <div className="mt-2">{demo}</div>
      </div>
    </div>
  );
}
