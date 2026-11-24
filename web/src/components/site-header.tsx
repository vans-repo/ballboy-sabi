import Link from "next/link";

import { Wordmark } from "@/components/logo";
import { ThemeButton } from "@/components/theme-button";
import { BRAND, SITE_NAME } from "@/config/site";

/** Phones: the site name (desktop has the sidebar instead). Navigation is the bottom tab bar. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" aria-label={`${SITE_NAME} by ${BRAND}, home`}>
          <Wordmark />
        </Link>
        <ThemeButton className="-mr-2" />
      </div>
    </header>
  );
}
