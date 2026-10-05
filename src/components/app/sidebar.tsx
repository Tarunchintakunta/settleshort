"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, ChartLineUpIcon, FileArrowDownIcon, HandCoinsIcon, GearSixIcon, SirenIcon, PulseIcon, SquaresFourIcon, StackIcon, TrayIcon, UsersThreeIcon, WalletIcon, type Icon } from "@phosphor-icons/react";
import { cx } from "@/components/ui";

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/app", label: "Overview", icon: SquaresFourIcon },
  { href: "/app/exceptions", label: "Exceptions", icon: SirenIcon },
  { href: "/app/claims", label: "Claims", icon: TrayIcon },
  { href: "/app/me", label: "My money", icon: WalletIcon },
  { href: "/app/batches", label: "Batches", icon: StackIcon },
  { href: "/app/advances", label: "Advances", icon: HandCoinsIcon },
  { href: "/app/insights", label: "Insights", icon: ChartLineUpIcon },
  { href: "/app/notifications", label: "Notifications", icon: BellIcon },
  { href: "/app/activity", label: "Activity", icon: PulseIcon },
  { href: "/app/exports", label: "Exports", icon: FileArrowDownIcon },
  { href: "/app/members", label: "Members", icon: UsersThreeIcon },
  { href: "/app/settings", label: "Settings", icon: GearSixIcon },
];

export function SideNav({ counts, hide = [] }: { counts: Record<string, number>; hide?: string[] }) {
  const path = usePathname();
  return (
    <nav aria-label="App" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible">
      {NAV.filter((n) => !hide.includes(n.href)).map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? path === href : path.startsWith(href);
        const count = counts[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex h-9 shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] tracking-[-0.011em] transition-colors duration-200",
              active ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-panel hover:text-ink",
            )}
          >
            <Icon className={cx("size-[18px]", active ? "text-accent" : "text-muted group-hover:text-ink-2")} weight={active ? "fill" : "regular"} aria-hidden />
            {label}
            {count ? (
              <span
                className="tnum ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-warning px-1.5 text-[11.5px] leading-none font-semibold text-on-accent"
                aria-label={`${count} need attention`}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
