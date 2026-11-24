import Link from "next/link";

import { PickButtons } from "@/components/picks/pick-buttons";
import { ShareMenu } from "@/components/share-menu";
import { ProbabilityBar } from "@/components/probability-bar";
import { RightWrong } from "@/components/right-wrong";
import { StatusTag } from "@/components/status-tag";
import { TeamBadge } from "@/components/team-badge";
import { bigMatchTags, derbyName } from "@/lib/big-match";
import type { Match, Prediction, TableRow, Team } from "@/lib/data";
import { hasResult, isLocked, isUpcoming, likeliest, outcomeOf } from "@/lib/football";
import { formatDay, formatKickoff, formatKickoffTime } from "@/lib/format";
import { matchShareMessage } from "@/lib/share-post";
import { VIDEO_LABEL, youtubeSearch } from "@/lib/youtube";

/**
 * A fixture card. States: upcoming (percentages), locked (kicked off, no
 * result yet), played (score and a mark against the model's most likely
 * result), postponed / abandoned / awarded / cancelled (tag).
 */
export function MatchCard({
  match,
  home,
  away,
  latest,
  frozen,
  now,
  pickable = false,
  table,
  seasonLabel,
}: {
  match: Match;
  home: Team;
  away: Team;
  latest?: Prediction;
  frozen?: Prediction;
  now: number;
  /** Show pick buttons while the match is open. */
  pickable?: boolean;
  /** This season's table: adds "Top-two clash" and similar tags before kick-off. */
  table?: TableRow[];
  /** The match's season, e.g. "2026/27": picks the official YouTube channel to search. */
  seasonLabel?: string;
}) {
  const played = hasResult(match);
  const upcoming = isUpcoming(match, now);
  const locked = isLocked(match, now);
  const outcome = outcomeOf(match);
  // Derbies always; table tags (top-two clash and so on) only before kick-off.
  const derby = derbyName(home, away);
  const tags =
    upcoming && table
      ? bigMatchTags(home, away, table)
      : derby
        ? [{ kind: "derby" as const, label: derby }]
        : [];

  return (
    <article className="rounded-2xl bg-surface p-4">
      <Link href={`/match/${match.id}`} className="block">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="figure rounded-md bg-background px-2 py-0.5 text-sm text-foreground uppercase">
              {formatDay(match.kickoff)}
              {upcoming && ` · ${formatKickoffTime(match)}`}
            </span>
            {locked && "Kicked off, result to come"}
          </span>
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {tags.map((t) => (
              <span
                key={t.label}
                className={
                  t.kind === "derby"
                    ? "rounded-md bg-primary px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-primary-foreground uppercase"
                    : "rounded-md border border-ink px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-foreground uppercase"
                }
              >
                {t.label}
              </span>
            ))}
            {upcoming && latest?.upset_alert && (
              <span className="rounded-md bg-away px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-[#001F55] uppercase">
                One To Watch 🔥
              </span>
            )}
            <StatusTag status={match.status} />
          </span>
        </div>
        <div className="mt-3 grid gap-1.5">
          {[
            { team: home, goals: match.homeGoals },
            { team: away, goals: match.awayGoals },
          ].map(({ team, goals }) => (
            <div key={team.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <TeamBadge team={team} size="sm" />
                <span className="font-medium">{team.name}</span>
              </span>
              {played && <span className="figure text-2xl leading-none">{goals}</span>}
            </div>
          ))}
        </div>
        {upcoming && latest && (
          <div className="mt-3">
            <ProbabilityBar p={latest} />
          </div>
        )}
        {upcoming && !latest && (
          <p className="mt-3 text-sm text-muted-foreground">
            Predictions update after each result.
          </p>
        )}
        {played && frozen && outcome && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <RightWrong right={likeliest(frozen) === outcome} />
            Ballboy: {Math.round(Number(frozen.p_home) * 100)}% /{" "}
            {Math.round(Number(frozen.p_draw) * 100)}% / {Math.round(Number(frozen.p_away) * 100)}%
          </p>
        )}
      </Link>
      {pickable && upcoming && latest && (
        <div className="mt-3">
          <PickButtons
            target={{
              matchId: match.id,
              kickoff: match.kickoff,
              probs: {
                home: Number(latest.p_home),
                draw: Number(latest.p_draw),
                away: Number(latest.p_away),
              },
            }}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <ShareMenu
          message={matchShareMessage(match, home.name, away.name, {
            played,
            upcoming,
            locked,
            when: `${formatKickoff(match)}${match.timeConfirmed ? " WAT" : ""}`,
            oneToWatch: upcoming && !!latest?.upset_alert,
          })}
          path={`/match/${match.id}`}
          image={`/match/${match.id}/opengraph-image`}
          imageName={`ballboy-sabi-${home.code}-${away.code}.png`.toLowerCase()}
          buttonClassName="h-11 bg-transparent px-0 text-ink hover:bg-transparent hover:underline"
        />
        {(match.videoUrl || played || locked) && (
          <a
            href={match.videoUrl ?? youtubeSearch(home.name, away.name, seasonLabel ?? "")}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink hover:underline"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
              <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.2 12z" />
            </svg>
            {match.videoUrl && match.videoLabel ? VIDEO_LABEL[match.videoLabel] : "Find on YouTube"}
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  );
}
