import Link from "next/link";

import { AddFixtureForm, CsvImport, FixtureEditor } from "@/components/admin/forms";
import { Card, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getContext } from "@/lib/data/context";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const lagosDate = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10);
const lagosTime = (iso: string) =>
  new Date(Date.parse(iso) + 3_600_000).toISOString().slice(11, 16);

export default async function AdminFixturesPage({ searchParams }: PageProps<"/admin/fixtures">) {
  await requireAdmin();
  const { season, md } = (await searchParams) as { season?: string; md?: string };
  const ctx = await getContext();
  const s = ctx.seasons.find((x) => x.label === season) ?? ctx.current;
  const inSeason = ctx.matches.filter((m) => m.seasonId === s.id);
  const days = [
    ...new Set(inSeason.map((m) => m.matchday).filter((d): d is number => d !== null)),
  ].sort((a, b) => a - b);
  const day = md
    ? Number(md)
    : (days.find((d) => inSeason.some((m) => m.matchday === d && m.status === "scheduled")) ??
      days[0]);
  const list = inSeason.filter((m) => m.matchday === day);
  const teams = [...ctx.teams.values()].map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <PageTitle sub={`${s.label}. Times are West Africa Time.`}>Fixtures</PageTitle>

      <Section title="Import a season's fixtures">
        <Card>
          <p className="mb-3 text-sm text-muted-foreground">
            Imports into {s.label}. Team names are checked against each team&apos;s aliases, and you
            see every problem before anything is saved. Matches already in the season are skipped.
          </p>
          <CsvImport seasonId={s.id} />
        </Card>
      </Section>

      <Section title="Add a fixture">
        <Card>
          <AddFixtureForm seasonId={s.id} teams={teams} />
        </Card>
      </Section>

      <Section title="Edit fixtures">
        <nav aria-label="Matchdays" className="mb-3 flex flex-wrap gap-1">
          {days.map((d) => (
            <Link
              key={d}
              href={`/admin/fixtures?season=${encodeURIComponent(s.label)}&md=${d}`}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-lg text-sm",
                d === day ? "bg-primary text-primary-foreground" : "bg-surface",
              )}
            >
              {d}
            </Link>
          ))}
        </nav>
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((m) => (
            <li key={m.id} className="rounded-xl bg-surface p-4">
              <p className="font-medium">
                {ctx.teams.get(m.homeId)!.name} v {ctx.teams.get(m.awayId)!.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDay(m.kickoff)} · {m.timeConfirmed ? lagosTime(m.kickoff) : "time TBC"} ·{" "}
                {m.status}
              </p>
              <FixtureEditor
                matchId={m.id}
                seasonId={s.id}
                date={lagosDate(m.kickoff)}
                time={m.timeConfirmed ? lagosTime(m.kickoff) : ""}
                matchday={m.matchday}
              />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
