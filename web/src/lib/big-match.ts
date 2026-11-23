import { DERBIES } from "@/config/rivalries";
import { TABLE_ZONES } from "@/config/site";
import type { TableRow, Team } from "@/lib/data";

/*
 * "Big match" tags: derbies (config/rivalries) and table clashes worked out
 * from the site's own table. Table tags start once teams have played five
 * games, so an early-season table doesn't label everything.
 */

export type BigMatch = { kind: "derby" | "table"; label: string };

const MIN_PLAYED = 5;
const TOP = 3;
const BOTTOM = TABLE_ZONES.relegation;

export function derbyName(home: Team, away: Team): string | null {
  return (
    DERBIES.find((d) => d.clubs.includes(home.slug) && d.clubs.includes(away.slug))?.name ?? null
  );
}

export function bigMatchTags(home: Team, away: Team, table: TableRow[]): BigMatch[] {
  const tags: BigMatch[] = [];
  const derby = derbyName(home, away);
  if (derby) tags.push({ kind: "derby", label: derby });

  const size = table.length;
  const h = table.find((r) => r.teamId === home.id);
  const a = table.find((r) => r.teamId === away.id);
  if (!h || !a || h.played < MIN_PLAYED || a.played < MIN_PLAYED || size < 8) return tags;
  const top = (r: TableRow) => r.position <= TOP;
  const bottom = (r: TableRow, n = BOTTOM) => r.position > size - n;
  const pair = [h.position, a.position].sort((x, y) => x - y);

  if (pair[0] === 1 && pair[1] === 2) tags.push({ kind: "table", label: "Top-two clash" });
  else if (top(h) && top(a)) tags.push({ kind: "table", label: "Top-of-table clash" });
  else if ((top(h) && bottom(a)) || (top(a) && bottom(h)))
    tags.push({ kind: "table", label: "Top v bottom" });
  else if (bottom(h, BOTTOM + 1) && bottom(a, BOTTOM + 1))
    tags.push({ kind: "table", label: "Relegation battle" });
  return tags;
}
