"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearSixIcon, PulseIcon, SquaresFourIcon, StackIcon, TrayIcon, UsersThreeIcon, type Icon } from "@phosphor-icons/react";
import { cx } from "@/components/ui";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/app", label: "Overview", icon: SquaresFourIcon },
  { href: "/app/claims", label: "Claims", icon: TrayIcon },
  { href: "/app/batches", label: "Batches", icon: StackIcon },
  { href: "/app/activity", label: "Activity", icon: PulseIcon },
  { href: "/app/members", label: "Members", icon: UsersThreeIcon },
  { href: "/app/settings", label: "Settings", icon: GearSixIcon },
];

export function SideNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="App" className="-mx-1 flex gap-0.5 overflow-x-auto md:mx-0 md:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex h-9 shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] transition-colors",
              active ? "bg-panel font-medium text-ink shadow-soft ring-1 ring-line" : "text-ink-2 hover:bg-panel/60 hover:text-ink",
            )}
          >
            <Icon className={cx("size-[18px]", active ? "text-accent" : "text-muted group-hover:text-ink-2")} weight={active ? "fill" : "regular"} aria-hidden />
            {label}
            {counts[href] ? <span className="ml-auto rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning tnum">{counts[href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
