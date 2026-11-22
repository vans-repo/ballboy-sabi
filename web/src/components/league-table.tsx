import Link from "next/link";

import { FormDots } from "@/components/form-dots";
import { TeamBadge } from "@/components/team-badge";
import { TABLE_ZONES } from "@/config/site";
import type { TableRow, Team } from "@/lib/data";
import { cn } from "@/lib/utils";

type Zone = "title" | "continental" | "relegation" | null;

export function zoneFor(position: number, size: number, grouped: boolean): Zone {
  if (grouped) return null;
  if (position <= TABLE_ZONES.title) return "title";
  if (position <= TABLE_ZONES.continental) return "continental";
  if (position > size - TABLE_ZONES.relegation) return "relegation";
  return null;
}

const ZONE_BAR = {
  title: "bg-primary",
  continental: "bg-away",
  relegation: "bg-danger",
} as const;

export function ZoneKey() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded bg-primary" aria-hidden="true" /> Champions
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded bg-away" aria-hidden="true" /> Continental places
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded bg-danger" aria-hidden="true" /> Relegation
      </li>
    </ul>
  );
}

/**
 * The league table. `compact` shows only P, GD and Pts (for the Home page);
 * `rows` may be a subset (top five and bottom three) with `size` the full count.
 */
export function LeagueTable({
  rows,
  teams,
  size,
  grouped = false,
  compact = false,
  caption,
}: {
  rows: TableRow[];
  teams: Map<string, Team>;
  size: number;
  grouped?: boolean;
  compact?: boolean;
  caption: string;
}) {
  const hasDeductions = rows.some((r) => r.pointsDeducted > 0);
  return (
    <div className="overflow-x-auto rounded-xl bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="w-8 py-2 pl-3 text-left font-medium">
              <abbr title="Position" className="no-underline">
                #
              </abbr>
            </th>
            <th scope="col" className="py-2 text-left font-medium">
              Team
            </th>
            <Th title="Played">P</Th>
            {!compact && (
              <>
                <Th title="Won">W</Th>
                <Th title="Drawn">D</Th>
                <Th title="Lost">L</Th>
                <Th title="Goals for" wide>
                  GF
                </Th>
                <Th title="Goals against" wide>
                  GA
                </Th>
              </>
            )}
            <Th title="Goal difference">GD</Th>
            {!compact && hasDeductions && <Th title="Points deducted">Ded</Th>}
            <Th title="Points">Pts</Th>
            {!compact && (
              <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">
                Form
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = teams.get(r.teamId);
            const zone = zoneFor(r.position, size, grouped);
            const gap = i > 0 && r.position > rows[i - 1].position + 1;
            return (
              <tr
                key={r.teamId}
                className={cn("border-b last:border-0", gap && "border-t-4 border-t-background")}
              >
                <td className="relative py-2 pl-3">
                  {zone && (
                    <span
                      className={cn("absolute inset-y-1 left-0 w-1 rounded-r", ZONE_BAR[zone])}
                      aria-hidden="true"
                    />
                  )}
                  <span className="figure">{r.position}</span>
                  {zone && (
                    <span className="sr-only">
                      ,{" "}
                      {zone === "title"
                        ? "champions"
                        : zone === "continental"
                          ? "continental place"
                          : "relegation"}
                    </span>
                  )}
                </td>
                <td className="py-1">
                  {team && (
                    <Link
                      href={`/team/${team.slug}`}
                      className="flex min-h-11 items-center gap-2 font-medium hover:underline"
                    >
                      <TeamBadge team={team} size="sm" />
                      <span className="truncate">{team.name}</span>
                    </Link>
                  )}
                </td>
                <Td>{r.played}</Td>
                {!compact && (
                  <>
                    <Td>{r.won}</Td>
                    <Td>{r.drawn}</Td>
                    <Td>{r.lost}</Td>
                    <Td wide>{r.goalsFor}</Td>
                    <Td wide>{r.goalsAgainst}</Td>
                  </>
                )}
                <Td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</Td>
                {!compact && hasDeductions && (
                  <Td>
                    {r.pointsDeducted > 0 ? (
                      <abbr title={r.deductionNotes ?? ""}>−{r.pointsDeducted}</abbr>
                    ) : (
                      ""
                    )}
                  </Td>
                )}
                <td className="figure px-2 py-2 text-right text-base">{r.points}</td>
                {!compact && (
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <FormDots results={r.form} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, title, wide }: { children: string; title: string; wide?: boolean }) {
  return (
    <th
      scope="col"
      className={cn("px-1.5 py-2 text-right font-medium", wide && "hidden sm:table-cell")}
    >
      <abbr title={title} className="no-underline">
        {children}
      </abbr>
    </th>
  );
}

function Td({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <td className={cn("px-1.5 py-2 text-right", wide && "hidden sm:table-cell")}>{children}</td>
  );
}
