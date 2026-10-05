"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellIcon,
  ChartLineUpIcon,
  DotsThreeIcon,
  FileArrowDownIcon,
  HandCoinsIcon,
  GearSixIcon,
  PlusCircleIcon,
  SirenIcon,
  SignOutIcon,
  PulseIcon,
  SquaresFourIcon,
  StackIcon,
  TrayIcon,
  UsersThreeIcon,
  WalletIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { logout } from "@/app/(auth)/actions";
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

// Bottom tab bar on phones; everything else lives under "More".
const TABS: { href: string; label: string; icon: Icon }[] = [
  { href: "/app", label: "Overview", icon: SquaresFourIcon },
  { href: "/app/claims", label: "Claims", icon: TrayIcon },
  { href: "/app/claims/new", label: "New", icon: PlusCircleIcon },
  { href: "/app/batches", label: "Batches", icon: StackIcon },
];

const isActive = (path: string, href: string) =>
  href === "/app" ? path === href : href === "/app/claims" ? path.startsWith(href) && !path.startsWith("/app/claims/new") : path.startsWith(href);

/** Badges come from the layout, then are re-read on every navigation so a cached layout never shows stale numbers. */
function useCounts(initial: Record<string, number>) {
  const path = usePathname();
  // Fresh numbers apply only on top of the layout render they were fetched for; a newer layout render wins.
  const [fresh, setFresh] = useState<{ base: Record<string, number>; c: Record<string, number> } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/v1/nav-counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => live && c && setFresh({ base: initial, c }))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [path, initial]);
  return fresh?.base === initial ? { ...initial, ...fresh.c } : initial;
}

function Badge({ n }: { n?: number }) {
  return n ? (
    <span
      className="tnum ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-warning px-1.5 text-[11.5px] leading-none font-semibold text-on-accent"
      aria-label={`${n} need attention`}
    >
      {n}
    </span>
  ) : null;
}

function NavList({ counts, hide, onNavigate }: { counts: Record<string, number>; hide: string[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <>
      {NAV.filter((n) => !hide.includes(n.href)).map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex h-11 shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] tracking-[-0.011em] transition-colors duration-200 md:h-9",
              active ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-panel hover:text-ink",
            )}
          >
            <Icon className={cx("size-[18px]", active ? "text-accent" : "text-muted group-hover:text-ink-2")} weight={active ? "fill" : "regular"} aria-hidden />
            {label}
            <Badge n={counts[href]} />
          </Link>
        );
      })}
    </>
  );
}

/** Desktop sidebar nav: scrolls on its own so the user block below it is always reachable. */
export function SideNav({ counts: initial, hide = [] }: { counts: Record<string, number>; hide?: string[] }) {
  const counts = useCounts(initial);
  return (
    <nav aria-label="App" className="-mx-1 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 md:flex">
      <NavList counts={counts} hide={hide} />
    </nav>
  );
}

/** Phones: fixed bottom tab bar plus a "More" drawer with the rest of the nav and Sign out. */
export function MobileNav({ counts: initial, hide = [], userName }: { counts: Record<string, number>; hide?: string[]; userName: string }) {
  const counts = useCounts(initial);
  const path = usePathname();
  // Open only on the page it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (o: boolean | ((o: boolean) => boolean)) => setOpenAt((typeof o === "function" ? o(open) : o) ? path : null);
  const inTabs = TABS.map((t) => t.href);
  const moreCount = NAV.filter((n) => !inTabs.includes(n.href) && !hide.includes(n.href)).reduce((s, n) => s + (counts[n.href] ?? 0), 0);

  return (
    <>
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-medium text-accent" : "text-muted")}
                >
                  <Icon className="size-[22px]" weight={active ? "fill" : "regular"} aria-hidden />
                  {label}
                  {counts[href] ? (
                    <span className="tnum absolute top-1.5 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-on-accent" aria-label={`${counts[href]} need attention`}>
                      {counts[href]}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="more-nav"
              onClick={() => setOpen((o) => !o)}
              className={cx("relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]", open ? "font-medium text-accent" : "text-muted")}
            >
              <DotsThreeIcon className="size-[22px]" weight="bold" aria-hidden />
              More
              {moreCount ? <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-warning" aria-label={`${moreCount} need attention`} /> : null}
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-[35] md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[rgb(12_12_14/0.45)]" onClick={() => setOpen(false)} />
          <div id="more-nav" className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[16px] border-t border-line bg-bg px-3 pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-pop">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Menu</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-[8px] text-muted hover:text-ink">
                <XIcon className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="More" className="flex flex-col gap-0.5">
              <NavList counts={counts} hide={[...hide, ...inTabs]} onNavigate={() => setOpen(false)} />
            </nav>
            <form action={logout} className="mt-3 flex items-center gap-2 border-t border-line px-1 pt-3">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{userName}</span>
              <button className="inline-flex h-11 items-center gap-2 rounded-[8px] px-3 text-sm text-ink-2 hover:bg-panel hover:text-ink">
                <SignOutIcon className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Workspace name in the phone header: truncated, tap to see it in full. */
export function WorkspaceLabel({ name }: { name: string }) {
  const [full, setFull] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFull((f) => !f)}
      aria-expanded={full}
      title={name}
      className={cx("min-h-11 min-w-0 text-right text-xs text-muted", full ? "break-words" : "truncate")}
    >
      {name}
    </button>
  );
}
