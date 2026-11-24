import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { logOut } from "@/app/auth/actions";
import { SettingsForm } from "@/components/me/settings-form";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/user";
import { getLeaderboard } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { formatDay, ordinal } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Me", robots: { index: false } };

export default function MePage() {
  return (
    <Suspense fallback={<PageTitle>Me</PageTitle>}>
      <Me />
    </Suspense>
  );
}

const NAMES = { home: "Home", draw: "Draw", away: "Away" } as const;

async function Me() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");

  const ctx = await getContext();
  const supabase = await createClient();
  const [{ data: picks }, season] = await Promise.all([
    supabase
      .from("picks")
      .select("match_id,outcome,pred_home_goals,pred_away_goals,points_if_correct,points_awarded")
      .eq("user_id", viewer.id),
    getLeaderboard("season", ctx.current.id),
  ]);
  const me = season.find((r) => r.userId === viewer.id);
  const fans = season.filter((r) => !r.isBallboy).length;
  const byId = new Map(ctx.matches.map((m) => [m.id, m]));
  const history = (picks ?? [])
    .map((p) => ({ p, m: byId.get(p.match_id)! }))
    .filter((x) => x.m)
    .sort((a, b) => Date.parse(b.m.kickoff) - Date.parse(a.m.kickoff));
  const placeholderName = /^Fan [0-9a-f]{8}$/.test(viewer.displayName);
  // "My Matchday": the latest matchday this season where one of my picks was scored.
  const lastScored = history.find(
    ({ p, m }) => p.points_awarded !== null && m.seasonId === ctx.current.id && m.matchday !== null,
  );
  const shareUrl = lastScored
    ? `${publicEnv.siteUrl}/share/${viewer.id}/${lastScored.m.matchday}`
    : null;
  const shareText = lastScored ? `My Matchday ${lastScored.m.matchday} on Beat the Ballboy` : "";

  return (
    <>
      <PageTitle sub={viewer.email ?? undefined}>{viewer.displayName}</PageTitle>

      {placeholderName && (
        <Card className="mb-6 border border-ink/50 text-sm">
          Choose a display name for the leaderboard in Settings below.
        </Card>
      )}

      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Section title={`${ctx.current.label} season`}>
            <Card className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Points</p>
                <p className="figure text-4xl">{me?.points ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="figure text-4xl">{me ? ordinal(me.rank) : "–"}</p>
                {me && (
                  <p className="text-xs text-muted-foreground">
                    of {fans + 1}, The Ballboy included
                  </p>
                )}
              </div>
              <p className="col-span-2 text-sm text-muted-foreground">
                {me
                  ? `${me.correct} correct results, ${me.exact} exact scores.`
                  : "Your points appear after your first pick is scored."}{" "}
                <Link href="/leaderboard" className="text-ink underline underline-offset-2">
                  Leaderboard
                </Link>
              </p>
            </Card>
          </Section>

          {shareUrl && lastScored && (
            <Section title="Share my matchday">
              <Card className="grid gap-3 text-sm">
                <p>Matchday {lastScored.m.matchday}: share your score as an image card.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  </Button>
                  <Button asChild variant="secondary">
                    <a
                      href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      X
                    </a>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/share/${viewer.id}/${lastScored.m.matchday}`}>Open the card</Link>
                  </Button>
                </div>
              </Card>
            </Section>
          )}

          <Section title="Your picks">
            {history.length ? (
              <ul className="overflow-hidden rounded-xl bg-surface text-sm">
                {history.map(({ p, m }) => {
                  const home = ctx.teams.get(m.homeId)!;
                  const away = ctx.teams.get(m.awayId)!;
                  const pts = p.points_awarded;
                  return (
                    <li key={p.match_id} className="border-b last:border-0">
                      <Link
                        href={`/match/${m.id}`}
                        className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {home.name} v {away.name}
                            {m.homeGoals !== null && ` (${m.homeGoals}–${m.awayGoals})`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDay(m.kickoff)} · Picked {NAMES[p.outcome]}
                            {p.pred_home_goals !== null &&
                              `, ${p.pred_home_goals}–${p.pred_away_goals}`}
                          </span>
                        </span>
                        <span className="figure shrink-0 text-xl">
                          {pts !== null
                            ? `${pts} pts`
                            : m.status === "abandoned" || m.status === "cancelled"
                              ? "Void"
                              : "–"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>
                No picks yet.{" "}
                <Link href="/pick-all" className="text-ink underline underline-offset-2">
                  Make your picks
                </Link>
              </Empty>
            )}
          </Section>
        </div>

        <div>
          <Section title="Settings">
            <Card className="grid gap-5">
              <SettingsForm displayName={viewer.displayName} emailOptIn={viewer.emailOptIn} />
            </Card>
          </Section>
          <form action={logOut}>
            <Button type="submit" variant="secondary">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
