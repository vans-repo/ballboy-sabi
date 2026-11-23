import Link from "next/link";

import { Wordmark } from "@/components/logo";
import { MENU } from "@/config/nav";
import { BRAND, SITE_NAME, SUBSTACK_URL } from "@/config/site";

/** Phones: logo, site name and the menu (desktop has the sidebar instead). No JavaScript needed. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Link href="/" aria-label={`${SITE_NAME} by ${BRAND}, home`}>
          <Wordmark />
        </Link>
        <nav aria-label="Site">
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

/** The sidebar's last links (desktop). */
export function SideNavFooter() {
  return (
    <>
      <a
        href={SUBSTACK_URL}
        target="_blank"
        rel="noopener"
        className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        Read on Substack <span aria-hidden="true">↗</span>
      </a>
    </>
  );
}
