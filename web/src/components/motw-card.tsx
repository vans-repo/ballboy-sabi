import Link from "next/link";

import { ProbabilityBar } from "@/components/probability-bar";
import { publicEnv } from "@/lib/env";
import { formatDay, formatKickoffTime, pct } from "@/lib/format";
import { type Motw, motwPostText, xIntentUrl } from "@/lib/motw";
import { cn } from "@/lib/utils";

/** "Post on X" (one click, text and link filled in) and "Save image" (the portrait poster). */
export function MotwShareButtons({ w, className }: { w: Motw; className?: string }) {
  const link = `${publicEnv.siteUrl}/motw/${w.key}`;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a
        href={xIntentUrl(motwPostText(w), link)}
        target="_blank"
        rel="noopener"
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-bold text-background hover:opacity-90"
      >
        <XIcon /> Post on X
      </a>
      <a
        href={`/motw/${w.key}/poster`}
        download={`ballboy-sabi-${w.key}.png`}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-muted px-4 text-sm font-semibold hover:bg-muted/70"
      >
        <DownloadIcon /> Save image
      </a>
    </div>
  );
}

/** Two team-colour bands with the codes overlapping, the away code in outline. */
export function TeamCodes({
  home,
  away,
  className,
}: {
  home: { code: string; primary_colour: string };
  away: { code: string; primary_colour: string };
  className?: string;
}) {
  return (
    <div className={cn("relative flex h-44 overflow-hidden", className)} aria-hidden="true">
      <div className="flex-1" style={{ background: home.primary_colour }} />
      <div className="flex-1" style={{ background: away.primary_colour }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center font-heading text-[5.5rem] leading-[0.82] font-extrabold tracking-tighter">
        <span className="-translate-x-8 text-white">{home.code}</span>
        {/* Filled with the away colour, so the home code doesn't show through the outline. */}
        <span
          className="translate-x-8 [-webkit-text-stroke:3px_white] [paint-order:stroke_fill]"
          style={{ color: away.primary_colour }}
        >
          {away.code}
        </span>
      </div>
    </div>
  );
}

const LABEL = { upset: "Upset Alert", closest: "Closest call" } as const;

/** The Match of the Week on Home: the match, or the week's fallback. */
export function MotwCard({ w }: { w: Motw }) {
  if (w.kind === "match") {
    return (
      <section aria-labelledby="motw" className="overflow-hidden rounded-2xl bg-surface">
        <Link href={`/match/${w.match.id}`} className="block">
          <div className="relative">
            <TeamCodes home={w.home} away={w.away} />
            <p className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-background/90 px-2 py-1 text-xs font-extrabold tracking-wide uppercase">
                Match of the Week
              </span>
              {w.label && (
                <span className="rounded-md bg-away px-2 py-1 text-xs font-extrabold tracking-wide text-[#001F55] uppercase">
                  {LABEL[w.label]}
                </span>
              )}
            </p>
          </div>
          <div className="px-4 pt-4">
            <h2 id="motw" className="text-2xl uppercase">
              {w.home.name} v {w.away.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Matchday {w.md} · {formatDay(w.match.kickoff)} · {formatKickoffTime(w.match)}
              {w.label === "upset" && ` · ${pct(w.p.p_away)} chance of an away win`}
            </p>
            <div className="mt-3">
              <ProbabilityBar p={w.p} />
            </div>
          </div>
        </Link>
        <MotwShareButtons w={w} className="p-4" />
      </section>
    );
  }
  return (
    <section aria-labelledby="motw" className="overflow-hidden rounded-2xl bg-surface">
      <div className="flex items-center gap-4 bg-primary p-5 text-primary-foreground">
        {w.kind === "recap" ? (
          <>
            <span className="figure text-7xl leading-none">
              {w.right}/{w.total}
            </span>
            <span className="font-heading text-xl leading-tight font-extrabold uppercase">
              Matchday {w.md}
              <br />
              results called right
            </span>
          </>
        ) : (
          <span className="font-heading text-3xl leading-tight font-extrabold uppercase">
            Beat the Ballboy
          </span>
        )}
      </div>
      <div className="p-4">
        <h2 id="motw" className="text-2xl uppercase">
          {w.kind === "recap" ? "The Ballboy's week" : "Free to play"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {w.kind === "recap"
            ? `No matches this week. ${w.top.map((t) => `${t.team.name} ${t.points} pts`).join(", ")} at the top.`
            : "Pick Home, Draw or Away for every NPFL match and score more for the results the model thought unlikely."}
        </p>
        <MotwShareButtons w={w} className="mt-3" />
      </div>
    </section>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
    </svg>
  );
}
