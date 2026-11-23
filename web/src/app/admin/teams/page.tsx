import Link from "next/link";

import {
  DeductionForm,
  MakeCurrentButton,
  RemoveDeductionButton,
  SeasonForm,
  SeasonTeamsEditor,
  ShowCrestsSwitch,
  TeamEditor,
} from "@/components/admin/forms";
import { Card, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getSettings } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function AdminTeamsPage({ searchParams }: PageProps<"/admin/teams">) {
  await requireAdmin();
  const { season } = (await searchParams) as { season?: string };
  const ctx = await getContext();
  const s = ctx.seasons.find((x) => x.label === season) ?? ctx.current;
  const supabase = await createClient();
  const [
    { data: seasonTeams },
    { data: aliases },
    { data: deductions },
    { data: crests },
    settings,
  ] = await Promise.all([
    supabase.from("season_teams").select("team_id,status").eq("season_id", s.id),
    supabase.from("team_aliases").select("id,alias,team_id").order("alias"),
    supabase.from("point_deductions").select("id,team_id,points,reason").eq("season_id", s.id),
    // Straight from the table: the public team list leaves crests out while they're hidden.
    supabase.from("teams").select("id,crest_url"),
    getSettings(),
  ]);
  const crestOf = new Map((crests ?? []).map((c) => [c.id, c.crest_url]));
  const teams = [...ctx.teams.values()];
  const options = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <PageTitle>Teams & Seasons</PageTitle>

      <Section title="Seasons">
        <Card className="grid gap-4">
          <ul className="grid gap-1">
            {[...ctx.seasons].reverse().map((x) => (
              <li key={x.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/teams?season=${encodeURIComponent(x.label)}`}
                  className={cn("font-medium", x.id === s.id && "text-primary underline")}
                >
                  {x.label}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {x.start_date} to {x.end_date}
                </span>
                {x.is_current ? (
                  <span className="text-xs font-medium text-primary">Current season</span>
                ) : (
                  <MakeCurrentButton seasonId={x.id} />
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary">
              Create a season
            </summary>
            <div className="mt-2">
              <SeasonForm />
            </div>
          </details>
        </Card>
      </Section>

      <Section title={`Teams in ${s.label}`}>
        <Card>
          <SeasonTeamsEditor
            seasonId={s.id}
            teams={options}
            current={Object.fromEntries((seasonTeams ?? []).map((r) => [r.team_id, r.status]))}
          />
        </Card>
      </Section>

      <Section title={`Point deductions, ${s.label}`}>
        <Card className="grid gap-3">
          {(deductions ?? []).length > 0 && (
            <ul className="grid gap-1 text-sm">
              {(deductions ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {ctx.teams.get(d.team_id)?.name}: −{d.points} ({d.reason})
                  </span>
                  <RemoveDeductionButton id={d.id} />
                </li>
              ))}
            </ul>
          )}
          <DeductionForm seasonId={s.id} teams={options} />
        </Card>
      </Section>

      <Section title="Crests">
        <Card>
          <ShowCrestsSwitch show={settings.showCrests} />
        </Card>
      </Section>

      <Section title="Teams">
        <ul className="grid gap-3">
          {teams.map((t) => (
            <li key={t.id}>
              <details className="rounded-xl bg-surface p-4">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
                  <span
                    aria-hidden="true"
                    className="figure inline-flex size-8 items-center justify-center rounded-full text-[0.65rem]"
                    style={{ background: t.primary_colour, color: t.secondary_colour }}
                  >
                    {t.code}
                  </span>
                  {t.name}
                  {!t.city && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (city not set)
                    </span>
                  )}
                </summary>
                <div className="mt-3">
                  <TeamEditor
                    teamId={t.id}
                    code={t.code}
                    city={t.city ?? ""}
                    primary={t.primary_colour}
                    secondary={t.secondary_colour}
                    crestUrl={crestOf.get(t.id) ?? null}
                    aliases={(aliases ?? [])
                      .filter((a) => a.team_id === t.id)
                      .map((a) => ({ id: a.id, alias: a.alias }))}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
