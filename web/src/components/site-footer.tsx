import Link from "next/link";

import { MENU } from "@/components/site-header";
import { BRAND, FREE_TO_PLAY_LINE, SITE_NAME, SUBSTACK_URL, X_HANDLE, X_URL } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-screen-lg px-4 py-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{FREE_TO_PLAY_LINE}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4">
          {MENU.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="inline-flex min-h-11 items-center hover:underline">
                {m.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={SUBSTACK_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center hover:underline"
            >
              Substack
            </a>
          </li>
          <li>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center hover:underline"
            >
              {X_HANDLE} on X
            </a>
          </li>
        </ul>
        <p className="mt-2">
          {SITE_NAME} by {BRAND}. Times are West Africa Time (WAT).
        </p>
      </div>
    </footer>
  );
}
