import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FormDots } from "@/components/form-dots";
import { TeamCodes } from "@/components/motw-card";
import { MyPicks } from "@/components/picks/my-picks";
import { PickPanel } from "@/components/picks/pick-panel";
import { ProbabilityBar } from "@/components/probability-bar";
import { RightWrong } from "@/components/right-wrong";
import { Card, Empty, Section } from "@/components/section";
import { StatusTag } from "@/components/status-tag";
import { TeamLink } from "@/components/team-badge";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getFanSplit, getFrozenPredictions, getLatestPredictions } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { abs, JsonLd } from "@/lib/seo";
import { renderTime } from "@/lib/time";
import {
  form,
  hasResult,
  isLocked,
  isUpcoming,
  likeliest,
  outcomeOf,
  record,
} from "@/lib/football";
import { formatKickoff, formatLongDay, formatShortDate, formatTime, pct } from "@/lib/format";
import { matchShareMessage } from "@/lib/share-post";
import { ShareMenu } from "@/components/share-menu";
import { VIDEO_LABEL, youtubeId, youtubeSearch } from "@/lib/youtube";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const info = await matchTitle(id);
  return info ?? { title: "Match" };
}

async function matchTitle(id: string): Promise<Metadata | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  if (!UUID.test(id)) return null;
  const ctx = await getContext();
  const m = ctx.matches.find((x) => x.id === id);
  if (!m) return null;
  const home = ctx.teams.get(m.homeId)!.name;
  const away = ctx.teams.get(m.awayId)!.name;
  const where = [
    `NPFL ${ctx.seasonLabel(m.seasonId)}`,
    m.matchday ? `Matchday ${m.matchday}` : null,
    m.kickoffEstimated ? null : formatShortDate(m.kickoff),
  ]
    .filter(Boolean)
    .join(", ");
  const canonical = `/match/${m.id}`;
  if (hasResult(m))
    return {
      title: `${home} ${m.homeGoals}–${m.awayGoals} ${away}: result`,
      description: `${home} ${m.homeGoals}–${m.awayGoals} ${away} (${where}). The result, the Ballboy's prediction before kick-off, and every past meeting.`,
      alternates: { canonical },
    };
  const p = (await getLatestPredictions())[m.id];
  const chances = p
    ? ` The Ballboy gives ${home} ${pct(p.p_home)}, a draw ${pct(p.p_draw)} and ${away} ${pct(p.p_away)}.`
    : "";
  return {
    title: `${home} vs ${away} prediction`,
    description: `${home} vs ${away} prediction (${where}).${chances} Likely scores, form and head-to-head. Free to play: beat the Ballboy.`,
    alternates: { canonical },
  };
}

export default function MatchPage({ params }: PageProps<"/match/[id]">) {
  return (
    <>
      <Suspense fallback={<p className="text-muted-foreground">Loading match…</p>}>
        <MatchFromParams params={params} />
      </Suspense>
      <Suspense>
        <MyPicks />
      </Suspense>
    </>
  );
}

async function MatchFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <MatchDetail id={id} />;
}

async function MatchDetail({ id }: { id: string }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  const now = renderTime();
  const ctx = await getContext();
  const m = ctx.matches.find((x) => x.id === id);
  if (!m) notFound();
  const [latest, frozen] = await Promise.all([getLatestPredictions(), getFrozenPredictions()]);
  const home = ctx.teams.get(m.homeId)!;
  const away = ctx.teams.get(m.awayId)!;
  const season = ctx.seasonLabel(m.seasonId);
  const played = hasResult(m);
  const upcoming = isUpcoming(m, now);
  const locked = isLocked(m, now);
  // Before kick-off: the latest prediction. From kick-off: the one frozen at kick-off.
  const p = upcoming ? latest[m.id] : frozen[m.id];
  const outcome = outcomeOf(m);

  const before = ctx.matches.filter(
    (x) => Date.parse(x.kickoff) < Date.parse(m.kickoff) && hasResult(x),
  );
  const meetings = before.filter(
    (x) =>
      (x.homeId === m.homeId && x.awayId === m.awayId) ||
      (x.homeId === m.awayId && x.awayId === m.homeId),
  );
  const h2h = record(meetings, home.id);
  const split = Date.parse(m.kickoff) <= now ? await getFanSplit(m.id) : null;
  const splitTotal = split ? split.home + split.draw + split.away : 0;
  const pickable = (upcoming || locked) && latest[m.id];

  return (
    <article>
      {/* 1. Header: team colours and codes, like the share poster */}
      <TeamCodes home={home} away={away} className="-mx-4 mb-4 md:mx-0 md:rounded-2xl" />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${home.name} vs ${away.name}`,
          url: abs(`/match/${m.id}`),
          sport: "Soccer",
          ...(m.kickoffEstimated ? {} : { startDate: m.kickoff }),
          eventStatus: `https://schema.org/${
            m.status === "postponed"
              ? "EventPostponed"
              : m.status === "cancelled" || m.status === "abandoned"
                ? "EventCancelled"
                : "EventScheduled"
          }`,
          homeTeam: { "@type": "SportsTeam", name: home.name, url: abs(`/team/${home.slug}`) },
          awayTeam: { "@type": "SportsTeam", name: away.name, url: abs(`/team/${away.slug}`) },
        }}
      />
      <header className="mb-6">
        <h1 className="sr-only">
          {played
            ? `${home.name} ${m.homeGoals}–${m.awayGoals} ${away.name}`
            : `${home.name} vs ${away.name} prediction`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {season}
          {m.matchday && ` · Matchday ${m.matchday}`}
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamLink team={home} size="lg" className="flex-col gap-1 text-center" />
          <div className="figure text-center text-5xl">
            {played ? (
              `${m.homeGoals}–${m.awayGoals}`
            ) : (
              <span className="text-2xl text-muted-foreground">v</span>
            )}
          </div>
          <TeamLink team={away} size="lg" className="flex-col gap-1 text-center" />
        </div>
        <p className="mt-3 text-center text-sm">
          {m.kickoffEstimated
            ? `${season} season (date not recorded)`
            : m.timeConfirmed
              ? `${formatLongDay(m.kickoff)}, ${formatTime(m.kickoff)} WAT`
              : upcoming
                ? `${formatLongDay(m.kickoff)}, time TBC`
                : formatLongDay(m.kickoff)}
        </p>
        <p className="mt-2 flex justify-center gap-2">
          <StatusTag status={m.status} />
          {locked && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              Kicked off, result to come
            </span>
          )}
        </p>
        {m.notes && <p className="mt-2 text-center text-sm text-muted-foreground">{m.notes}</p>}
        <div className="mt-3 flex justify-center">
          <ShareMenu
            message={matchShareMessage(m, home.name, away.name, {
              played,
              upcoming,
              locked,
              when: `${formatKickoff(m)}${m.timeConfirmed ? " WAT" : ""}`,
              oneToWatch: upcoming && !!p?.upset_alert,
            })}
            path={`/match/${m.id}`}
            image={`/match/${m.id}/opengraph-image`}
            imageName={`ballboy-sabi-${home.code}-${away.code}.png`.toLowerCase()}
            label="Share this match…"
            className="text-center"
          />
        </div>
      </header>

      {/* Official YouTube video: played in place, with a link out. */}
      {m.videoUrl && youtubeId(m.videoUrl) ? (
        <section aria-label="Video" className="mb-6">
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId(m.videoUrl)}`}
              title={`${home.name} v ${away.name}: ${m.videoLabel ? VIDEO_LABEL[m.videoLabel] : "video"}`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              loading="lazy"
              className="size-full"
            />
          </div>
          <a
            href={m.videoUrl}
            target="_blank"
            rel="noopener"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:underline"
          >
            {m.videoLabel ? VIDEO_LABEL[m.videoLabel] : "Watch"} on YouTube ↗
          </a>
        </section>
      ) : (
        (played || locked) && (
          <p className="mb-6">
            <a
              href={youtubeSearch(home.name, away.name, season)}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:underline"
            >
              Find this match on YouTube ↗
            </a>
          </p>
        )
      )}

      {m.status === "postponed" && (
        <Card className="mb-6 border border-ink/50">
          <p className="text-sm">
            This match was postponed. Picks carry over to the new date, {formatKickoff(m)}
            {m.timeConfirmed ? " WAT" : ""}.
          </p>
        </Card>
      )}

      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          {/* 2–4. Prediction */}
          <Section title={upcoming ? "Prediction" : "Prediction at kick-off"}>
            {p ? (
              <Card>
                <ProbabilityBar p={p} size="lg" />
                {played && outcome && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-sm">
                    <RightWrong right={likeliest(p) === outcome} />
                    The Ballboy rated{" "}
                    {outcome === "draw"
                      ? "a draw"
                      : outcome === "home"
                        ? "a home win"
                        : "an away win"}{" "}
                    at{" "}
                    {pct(outcome === "home" ? p.p_home : outcome === "draw" ? p.p_draw : p.p_away)}.
                  </p>
                )}
              </Card>
            ) : (
              <Empty>
                {played || locked
                  ? "No prediction was published before this match kicked off."
                  : "Predictions update after each result."}
              </Empty>
            )}
          </Section>

          {p && (
            <Section title="Most likely scores">
              <ol className="grid grid-cols-3 gap-3">
                {p.top_scores.map((s) => (
                  <li key={`${s.home}-${s.away}`} className="rounded-xl bg-surface p-3 text-center">
                    <span className="figure block text-3xl">
                      {s.home}–{s.away}
                    </span>
                    <span className="text-sm text-muted-foreground">{pct(s.p)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        <div>
          {/* 5. Pick panel */}
          {pickable && (
            <Section title="Your pick">
              <PickPanel
                target={{
                  matchId: m.id,
                  kickoff: m.kickoff,
                  probs: {
                    home: Number(latest[m.id].p_home),
                    draw: Number(latest[m.id].p_draw),
                    away: Number(latest[m.id].p_away),
                  },
                }}
                labels={{ home: home.name, away: away.name }}
              />
            </Section>
          )}

          {/* 6. Form */}
          <Section title="Form">
            <Card className="grid gap-3">
              {[home, away].map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  <FormDots results={form(before, t.id)} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Last five league games before this match, oldest first.
              </p>
            </Card>
          </Section>

          {/* 7. Head-to-head */}
          <Section
            title="Head-to-head"
            more={{ href: `/h2h?a=${home.slug}&b=${away.slug}`, label: "Full record" }}
          >
            {meetings.length ? (
              <Card>
                <p className="text-sm">
                  {meetings.length} meetings since 2021/22: {home.name} won {h2h.won}, {h2h.drawn}{" "}
                  drawn, {away.name} won {h2h.lost}.
                </p>
                <ul className="mt-3 grid gap-1 text-sm">
                  {meetings
                    .slice(-5)
                    .reverse()
                    .map((x) => (
                      <li key={x.id}>
                        <Link
                          href={`/match/${x.id}`}
                          className="flex min-h-11 items-center justify-between gap-2 hover:underline"
                        >
                          <span className="text-muted-foreground">
                            {x.kickoffEstimated
                              ? ctx.seasonLabel(x.seasonId)
                              : formatShortDate(x.kickoff)}
                          </span>
                          <span>
                            {ctx.teams.get(x.homeId)!.name}{" "}
                            <span className="figure">
                              {x.homeGoals}–{x.awayGoals}
                            </span>{" "}
                            {ctx.teams.get(x.awayId)!.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </Card>
            ) : (
              <Empty>These teams have not met since 2021/22.</Empty>
            )}
          </Section>

          {/* 8. Fan split, only after kick-off */}
          {split && splitTotal > 0 && (
            <Section title="What fans picked">
              <Card>
                <p className="text-sm">
                  {pct(Math.max(split.home, split.draw, split.away) / splitTotal)} of fans picked{" "}
                  {split.home >= split.draw && split.home >= split.away
                    ? "Home"
                    : split.draw >= split.away
                      ? "Draw"
                      : "Away"}
                  .
                </p>
                <dl className="mt-3 grid grid-cols-3 text-center text-sm">
                  {(["home", "draw", "away"] as const).map((o) => (
                    <div key={o}>
                      <dt className="text-xs text-muted-foreground">
                        {o === "home" ? "Home" : o === "draw" ? "Draw" : "Away"}
                      </dt>
                      <dd className="figure text-2xl">{pct(split[o] / splitTotal)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  {splitTotal} fans picked this match.
                </p>
              </Card>
            </Section>
          )}
        </div>
      </div>
    </article>
  );
}
