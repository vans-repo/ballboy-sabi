import Link from "next/link";

import { MotwChooser } from "@/components/admin/forms";
import { MotwShareButtons } from "@/components/motw-card";
import { Card, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getLatestPredictions, getSettings } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { currentMatchday, isUpcoming } from "@/lib/football";
import { formatDay, pct } from "@/lib/format";
import { currentMotw, motwPostText } from "@/lib/motw";
import { renderTime } from "@/lib/time";

const KIND = {
  match: "This week's match",
  recap: "No matches this week: the Ballboy's week",
  start: "Pre-season: Beat the Ballboy",
} as const;

/** See this week's Match of the Week, and choose another match if you want. */
export default async function AdminMotwPage() {
  await requireAdmin();
  const now = renderTime();
  const [w, ctx, latest, settings] = await Promise.all([
    currentMotw(now),
    getContext(),
    getLatestPredictions(),
    getSettings(),
  ]);
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const md = currentMatchday(season, now);
  const open = season.filter((m) => m.matchday === md && isUpcoming(m, now) && latest[m.id]);

  return (
    <>
      <PageTitle sub="Picked automatically: the Upset Alert with the highest away-win chance, else the closest match. Choose another match below if you want.">
        Match of the Week
      </PageTitle>

      <Section title="This week">
        <Card className="grid gap-4 sm:grid-cols-[200px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
          <img
            src={`/motw/${w.key}/poster`}
            width={1080}
            height={1350}
            alt=""
            className="h-auto w-full rounded-lg"
          />
          <div className="grid content-start gap-2 text-sm">
            <p className="font-medium">{KIND[w.kind]}</p>
            {w.kind === "match" && (
              <p>
                {w.home.name} v {w.away.name}
                {w.chosenByAdmin ? " (your choice)" : " (automatic)"}
              </p>
            )}
            <p className="text-muted-foreground">{motwPostText(w)}</p>
            <MotwShareButtons w={w} />
            <p>
              <Link href={`/motw/${w.key}`} className="text-primary underline">
                Open the share page
              </Link>
            </p>
          </div>
        </Card>
      </Section>

      {open.length > 0 && (
        <Section title={`Choose a match, Matchday ${md}`}>
          <Card>
            <MotwChooser
              chosen={
                open.some((m) => m.id === settings.motwOverride) ? settings.motwOverride : null
              }
              matches={open.map((m) => {
                const p = latest[m.id];
                return {
                  id: m.id,
                  label: `${ctx.teams.get(m.homeId)!.name} v ${ctx.teams.get(m.awayId)!.name} · ${formatDay(m.kickoff)} · ${pct(p.p_home)}/${pct(p.p_draw)}/${pct(p.p_away)}${p.upset_alert ? " · Upset Alert" : ""}`,
                };
              })}
            />
          </Card>
        </Section>
      )}
    </>
  );
}
