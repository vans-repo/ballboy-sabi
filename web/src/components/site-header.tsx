import Link from "next/link";

import { TopTabs } from "@/components/site-nav";
import { SITE_NAME, SUBSTACK_URL } from "@/config/site";

export const MENU = [
  { href: "/teams", label: "Teams" },
  { href: "/h2h", label: "Head-to-Head" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/about", label: "How It Works" },
] as const;

/** Site name, the five tabs (desktop) and the top menu. The menu needs no JavaScript. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-lg items-center justify-between gap-2 px-4">
        <Link href="/" className="font-heading text-xl font-extrabold tracking-tight uppercase">
          {SITE_NAME}
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1">
          <TopTabs />
          <details className="group relative">
            <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <ul className="absolute right-0 mt-1 w-56 rounded-xl border bg-surface p-1 shadow-lg">
              {MENU.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className="flex h-11 items-center rounded-lg px-3 text-sm hover:bg-muted"
                  >
                    {m.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={SUBSTACK_URL}
                  target="_blank"
                  rel="noopener"
                  className="flex h-11 items-center rounded-lg px-3 text-sm hover:bg-muted"
                >
                  Read on Substack <span aria-hidden="true">&nbsp;↗</span>
                </a>
              </li>
            </ul>
          </details>
        </nav>
      </div>
    </header>
  );
}
