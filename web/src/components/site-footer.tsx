import Link from "next/link";

import { Logo } from "@/components/logo";
import { MENU } from "@/config/nav";
import {
  BRAND,
  FREE_TO_PLAY_LINE,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  NOT_AFFILIATED_LINE,
  SITE_NAME,
  SUBSTACK_URL,
  X_HANDLE,
  X_URL,
} from "@/config/site";

const link = "inline-flex min-h-11 items-center hover:underline";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground md:px-8">
        <p className="font-medium text-foreground">{FREE_TO_PLAY_LINE}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4">
          {MENU.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className={link}>
                {m.label}
              </Link>
            </li>
          ))}
          <li>
            <a href={SUBSTACK_URL} target="_blank" rel="noopener" className={link}>
              Substack
            </a>
          </li>
          <li>
            <a href={X_URL} target="_blank" rel="noopener" className={link}>
              {X_HANDLE} on X
            </a>
          </li>
          <li>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className={link}>
              {INSTAGRAM_HANDLE} on Instagram
            </a>
          </li>
        </ul>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <Logo className="h-4 w-auto text-primary" title={BRAND} />
          <span>
            {SITE_NAME} by {BRAND}. Times are West Africa Time (WAT).
          </span>
        </p>
        <p className="mt-1">{NOT_AFFILIATED_LINE} Club names and crests belong to their clubs.</p>
      </div>
    </footer>
  );
}
