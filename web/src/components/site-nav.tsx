"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

export const TABS = [
  { href: "/", label: "Home" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/table", label: "Table" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/me", label: "Me" },
] as const;

function isActive(path: string | null, href: string) {
  if (path === null) return false;
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function BottomTabsView({ path }: { path: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-screen-md grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(path, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 items-center justify-center text-[0.8rem] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TopTabsView({ path }: { path: string | null }) {
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {TABS.map((t) => {
        const active = isActive(path, t.href);
        return (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted",
                active ? "text-primary" : "text-foreground",
              )}
            >
              {t.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WithPath({ view: View }: { view: typeof BottomTabsView }) {
  return <View path={usePathname()} />;
}

/** Phones: the bottom tab bar. The active tab is highlighted once the URL is known. */
export function BottomTabs() {
  return (
    <Suspense fallback={<BottomTabsView path={null} />}>
      <WithPath view={BottomTabsView} />
    </Suspense>
  );
}

/** Desktop: the same five as top links. */
export function TopTabs() {
  return (
    <Suspense fallback={<TopTabsView path={null} />}>
      <WithPath view={TopTabsView} />
    </Suspense>
  );
}
