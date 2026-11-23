import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { LazyCalibrationChart } from "@/components/charts/lazy-charts";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getFrozenPredictions, getWalkForward } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { hasResult, likeliest, outcomeOf } from "@/lib/football";
import { pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Accuracy",
  description:
    "How good our NPFL percentages are, compared with always picking the home team. Every prediction is scored.",
};

export default async function AccuracyPage() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.predictions);
  const ctx = await getContext();
  const [frozen, walk] = await Promise.all([getFrozenPredictions(), getWalkForward()]);

  // Live record: this season's results against the prediction frozen at kick-off.
  const scored = ctx.matches
    .filter((m) => m.seasonId === ctx.current.id && hasResult(m) && frozen[m.id])
    .map((m) => {
      const p = frozen[m.id];
      const o = outcomeOf(m)!;
      const probs = { home: Number(p.p_home), draw: Number(p.p_draw), away: Number(p.p_away) };
      return { m, p, o, right: likeliest(p) === o, logLoss: -Math.log(Math.max(probs[o], 0.005)) };
    });
  const n = scored.length;
  const liveLogLoss = n ? scored.reduce((s, x) => s + x.logLoss, 0) / n : 0;
  const liveRight = scored.filter((x) => x.right).length;
  const homeWins = scored.filter((x) => x.o === "home").length;
  const byMatchday = new Map<number, { n: number; right: number; home: number }>();
  for (const x of scored) {
    const d = x.m.matchday ?? 0;
    const e = byMatchday.get(d) ?? { n: 0, right: 0, home: 0 };
    e.n++;
    e.right += Number(x.right);
    e.home += Number(x.o === "home");
    byMatchday.set(d, e);
  }
  const alerts = scored.filter((x) => x.p.upset_alert);
  const alertHits = alerts.filter((x) => x.o === "away").length;

  return (
    <>
      <PageTitle sub="Every prediction is frozen at kick-off and scored against the result.">
        Accuracy
      </PageTitle>

      <Section title={`This season (${ctx.current.label})`}>
        {n ? (
          <Card className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Our most likely result was right</p>
              <p className="figure text-4xl">{pct(liveRight / n)}</p>
              <p className="text-sm text-muted-foreground">
                Always picking home: {pct(homeWins / n)} ({n} matches)
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                How good our percentages are (log-loss, lower is better)
              </p>
              <p className="figure text-4xl">{liveLogLoss.toFixed(3)}</p>
              {walk && (
                <p className="text-sm text-muted-foreground">
                  League averages scored {walk.league_average.log_loss.toFixed(3)} in testing
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Empty>
            The live record starts with the first result after our first published predictions. Each
            match is scored against the prediction made before kick-off, so nothing is scored after
            the event.
          </Empty>
        )}
      </Section>

      {walk && (
        <Section title="Tested on past seasons">
          <Card>
            <p className="text-sm">
              Before launch, we tested the model on {walk.matches} matches from{" "}
              {walk.seasons.join(" and ")}. Each week it learned only from games already played,
              then predicted that week&apos;s matches.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure label="Most likely result right" value={pct(walk.blend.accuracy)} />
              <Figure label="Always picking home" value={pct(walk.always_home_accuracy)} />
              <Figure label="Our percentages (Brier)" value={walk.blend.brier.toFixed(3)} />
              <Figure
                label="Always home (Brier)"
                value={(2 * (1 - walk.always_home_accuracy)).toFixed(3)}
              />
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              In plain words: picking the home team is right about {pct(walk.always_home_accuracy)}{" "}
              of the time in the NPFL, so no model beats it by much on right-or-wrong. Our
              percentages say how likely each result is, and they score clearly better than always
              saying &quot;home&quot; (a Brier score of {walk.blend.brier.toFixed(2)} against{" "}
              {(2 * (1 - walk.always_home_accuracy)).toFixed(2)}; lower is better). They also beat
              plain league averages (log-loss {walk.blend.log_loss.toFixed(3)} against{" "}
              {walk.league_average.log_loss.toFixed(3)}).
            </p>
          </Card>
        </Section>
      )}

      {walk && walk.calibration.length > 0 && (
        <Section title="Calibration">
          <Card>
            <p className="mb-3 text-sm text-muted-foreground">
              When we said the home team had a 60–70% chance, how often did it win? Bars near the
              line mean the percentages can be trusted. From the {walk.matches} test matches.
            </p>
            <LazyCalibrationChart points={walk.calibration} />
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Calibration table</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">We predicted</th>
                  <th className="text-right font-medium">Matches</th>
                  <th className="text-right font-medium">Average</th>
                  <th className="text-right font-medium">Home won</th>
                </tr>
              </thead>
              <tbody>
                {walk.calibration.map((c) => (
                  <tr key={c.bucket} className="border-t">
                    <td className="py-1">{c.bucket}</td>
                    <td className="text-right">{c.matches}</td>
                    <td className="text-right">{pct(c.predicted)}</td>
                    <td className="text-right">{pct(c.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      <Section title="Matchday by matchday">
        {byMatchday.size ? (
          <ul className="overflow-hidden rounded-xl bg-surface text-sm">
            {[...byMatchday.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([d, e]) => (
                <li
                  key={d}
                  className="flex min-h-11 items-center justify-between border-b px-4 last:border-0"
                >
                  <span>Matchday {d}</span>
                  <span>
                    {e.right} of {e.n} right · always home {e.home} of {e.n}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <Empty>No scored matchdays yet. Predictions update after each result.</Empty>
        )}
      </Section>

      <Section title="Upset Alerts">
        {alerts.length ? (
          <Card>
            <p className="text-sm">
              <span className="figure text-3xl">{alertHits}</span> of {alerts.length} Upset Alerts
              ended in an away win ({pct(alertHits / alerts.length)}).
            </p>
          </Card>
        ) : (
          <Empty>No Upset Alerts have been scored yet.</Empty>
        )}
      </Section>

      <Section title="How the model works">
        <Card className="grid gap-2 text-sm">
          <p>
            We average two simple models. The first is a strength rating (an Elo rating, the system
            chess uses): every team has a number that goes up when it beats a stronger side and down
            when it loses. The second counts goals: it learns how many each team scores and lets in,
            home and away, with recent games counting most.
          </p>
          <p>
            Both learn from every NPFL match since 2021/22, and only from games played before the
            match being predicted. The percentages update after every result.
          </p>
          <p>
            We judge the model by how good its percentages are (log-loss), not by how often its most
            likely result comes in, and we compare it with always picking the home team.
          </p>
        </Card>
      </Section>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="figure text-3xl">{value}</dd>
    </div>
  );
}
