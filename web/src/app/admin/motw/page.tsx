import Link from "next/link";

import { MotwChooser } from "@/components/admin/forms";
import { MotwShareButtons } from "@/components/motw-card";
import { Card, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { bigMatchTags } from "@/lib/big-match";
import { getLatestPredictions, getLeagueTable, getSettings } from "@/lib/data";
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
  const ctx = await getContext();
  const [w, latest, settings, table] = await Promise.all([
    currentMotw(now),
    getLatestPredictions(),
    getSettings(),
    getLeagueTable(ctx.current.id),
  ]);
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const md = currentMatchday(season, now);
  const open = season.filter((m) => m.matchday === md && isUpcoming(m, now) && latest[m.id]);
  // For articles and posts: derbies, table clashes and Upset Alerts this matchday.
  const big = open
    .map((m) => {
      const home = ctx.teams.get(m.homeId)!;
      const away = ctx.teams.get(m.awayId)!;
      const labels = bigMatchTags(home, away, table).map((t) => t.label);
      if (latest[m.id].upset_alert) labels.push("Upset Alert");
      const pos = (id: string) => table.find((r) => r.teamId === id)?.position;
      return { m, home, away, labels, hp: pos(home.id), ap: pos(away.id) };
    })
    .filter((x) => x.labels.length);

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
              <Link href={`/motw/${w.key}`} className="text-ink underline">
                Open the share page
              </Link>
            </p>
          </div>
        </Card>
      </Section>

      <Section title={`Big matches, Matchday ${md ?? ""}`}>
        {big.length ? (
          <ul className="grid gap-2">
            {big.map(({ m, home, away, labels, hp, ap }) => (
              <li key={m.id} className="rounded-xl bg-surface p-4 text-sm">
                <p className="font-medium">
                  <Link href={`/match/${m.id}`} className="hover:underline">
                    {home.name}
                    {hp ? ` (${hp})` : ""} v {away.name}
                    {ap ? ` (${ap})` : ""}
                  </Link>
                </p>
                <p className="text-muted-foreground">
                  {labels.join(" · ")} · {formatDay(m.kickoff)} · {pct(latest[m.id].p_home)} /{" "}
                  {pct(latest[m.id].p_draw)} / {pct(latest[m.id].p_away)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <p className="text-sm text-muted-foreground">
              No derbies, table clashes or Upset Alerts in this matchday&apos;s open matches.
            </p>
          </Card>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Table positions in brackets. Derbies and club history: docs/club-research.md.
        </p>
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
