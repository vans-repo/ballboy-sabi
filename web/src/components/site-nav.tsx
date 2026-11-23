"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { Wordmark } from "@/components/logo";
import { MENU } from "@/config/nav";
import { BRAND, SITE_NAME } from "@/config/site";
import { cn } from "@/lib/utils";

const icon = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

export const TABS = [
  {
    href: "/",
    label: "Home",
    icon: icon(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  },
  {
    href: "/fixtures",
    label: "Fixtures",
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>,
    ),
  },
  { href: "/table", label: "Table", icon: icon(<path d="M4 6h16M4 12h16M4 18h16M9 6v12" />) },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: icon(
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
    ),
  },
  {
    href: "/me",
    label: "Me",
    icon: icon(
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>,
    ),
  },
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
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem]",
                  active ? "font-bold text-ink" : "font-medium text-muted-foreground",
                )}
              >
                {active && (
                  <span
                    className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-primary"
                    aria-hidden="true"
                  />
                )}
                {t.icon}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideNavView({ path, footer }: { path: string | null; footer: ReactNode }) {
  const item = (active: boolean) =>
    cn(
      "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
      active ? "bg-primary font-bold text-primary-foreground" : "font-medium hover:bg-muted",
    );
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {TABS.map((t) => {
        const active = isActive(path, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={item(active)}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
      <span className="my-2 h-px bg-border" aria-hidden="true" />
      {MENU.map((m) => {
        const active = isActive(path, m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={active ? "page" : undefined}
            className={cn(item(active), !active && "text-muted-foreground")}
          >
            {m.label}
          </Link>
        );
      })}
      {footer}
    </nav>
  );
}

function BottomTabsWithPath() {
  return <BottomTabsView path={usePathname()} />;
}

function SideNavWithPath({ footer }: { footer: ReactNode }) {
  return <SideNavView path={usePathname()} footer={footer} />;
}

/** Phones: the bottom tab bar, with icons. The active tab is highlighted once the URL is known. */
export function BottomTabs() {
  return (
    <Suspense fallback={<BottomTabsView path={null} />}>
      <BottomTabsWithPath />
    </Suspense>
  );
}

/** Desktop: the sidebar with the logo, the five tabs and the menu. */
export function SideNav({ footer }: { footer: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r px-3 py-6 md:flex">
      <Link href="/" className="px-3" aria-label={`${SITE_NAME} by ${BRAND}, home`}>
        <Wordmark size="lg" />
      </Link>
      <Suspense fallback={<SideNavView path={null} footer={footer} />}>
        <SideNavWithPath footer={footer} />
      </Suspense>
    </aside>
  );
}
