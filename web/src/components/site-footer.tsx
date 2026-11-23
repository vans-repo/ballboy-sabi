import Link from "next/link";

import { Logo } from "@/components/logo";
import {
  BRAND,
  CONTACT_EMAIL,
  FREE_TO_PLAY_LINE,
  INSTAGRAM_URL,
  NOT_AFFILIATED_LINE,
  SUBSTACK_URL,
  X_URL,
} from "@/config/site";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/table", label: "Table" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const link = "inline-flex min-h-11 items-center hover:underline md:min-h-0";

/**
 * Compact footer: the main pages, where to follow That Naija Ballboy (and
 * email, once NEXT_PUBLIC_CONTACT_EMAIL is set), then the small print.
 */
export function SiteFooter() {
  const follow = [
    { href: X_URL, label: "X" },
    { href: INSTAGRAM_URL, label: "Instagram" },
    { href: SUBSTACK_URL, label: "Substack" },
  ];
  return (
    <footer className="mt-10 border-t">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-4 text-sm md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className={link}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="flex flex-wrap items-center gap-x-4 text-muted-foreground">
            <li className="text-foreground">Follow</li>
            {follow.map((f) => (
              <li key={f.label}>
                <a href={f.href} target="_blank" rel="noopener" className={link}>
                  {f.label}
                </a>
              </li>
            ))}
            {CONTACT_EMAIL && (
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                  Email me
                </a>
              </li>
            )}
          </ul>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Logo className="h-3 w-auto text-ink" title={BRAND} />
          <span>© {BRAND}.</span>
          <span>{FREE_TO_PLAY_LINE}</span>
          <span>{NOT_AFFILIATED_LINE} Club names and crests belong to their clubs.</span>
          <span>Times are WAT.</span>
        </p>
      </div>
    </footer>
  );
}
