import Link from "next/link";

import { SuggestionButtons } from "@/components/admin/forms";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getContext } from "@/lib/data/context";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const KIND = {
  result: "Result",
  postponed: "Postponed",
  kickoff: "Kick-off time",
  deduction: "Point deduction",
} as const;

/** Fixes suggested by the scheduled NPFL data check, one tap to apply each. */
export default async function DataCheckPage() {
  await requireAdmin();
  const ctx = await getContext();
  const supabase = await createClient();
  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("data_suggestions")
      .select("id,check_date,kind,match_id,team_id,payload,summary,source_url,confidence")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("data_suggestions")
      .select("id,kind,summary,status,decided_at")
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(10),
  ]);

  // What the site shows now, next to each suggestion.
  const now = (matchId: string | null) => {
    const m = matchId ? ctx.matches.find((x) => x.id === matchId) : undefined;
    if (!m) return null;
    const teams = `${ctx.teams.get(m.homeId)?.name} v ${ctx.teams.get(m.awayId)?.name}`;
    const state =
      m.homeGoals !== null
        ? `${m.homeGoals}–${m.awayGoals}`
        : m.status === "postponed"
          ? "postponed"
          : formatKickoff(m);
    return { id: m.id, teams, state };
  };

  return (
    <>
      <PageTitle sub="Suggested by the NPFL data check (Sunday and Wednesday nights). Check the source, then Apply or Dismiss. Applying works exactly like entering it by hand.">
        Data check
      </PageTitle>

      <Section title={`Waiting (${pending?.length ?? 0})`}>
        {pending?.length ? (
          <ul className="grid gap-3">
            {pending.map((s) => {
              const site = now(s.match_id);
              const team = s.team_id ? ctx.teams.get(s.team_id) : undefined;
              return (
                <li key={s.id}>
                  <Card className="grid gap-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold uppercase">
                        {KIND[s.kind as keyof typeof KIND] ?? s.kind}
                      </span>
                      {s.confidence === "unconfirmed" && (
                        <span className="rounded-md border border-danger px-2 py-0.5 text-xs font-bold text-danger uppercase">
                          Unconfirmed
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Check of {formatShortDate(s.check_date)}
                      </span>
                    </p>
                    <p className="font-medium">{s.summary}</p>
                    {site && (
                      <p className="text-muted-foreground">
                        Site now:{" "}
                        <Link href={`/match/${site.id}`} className="underline">
                          {site.teams}
                        </Link>
                        , {site.state}
                      </p>
                    )}
                    {team && <p className="text-muted-foreground">Club: {team.name}</p>}
                    {s.source_url && (
                      <p>
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noopener"
                          className="break-all text-ink underline"
                        >
                          Source ↗
                        </a>
                      </p>
                    )}
                    <SuggestionButtons id={s.id} />
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nothing waiting. The next check runs on Sunday or Wednesday night.</Empty>
        )}
      </Section>

      {recent && recent.length > 0 && (
        <Section title="Recently handled">
          <ul className="grid gap-1 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{r.summary}</span>
                <span className="text-muted-foreground">
                  {r.status === "applied" ? "Applied" : "Dismissed"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
