import "server-only";

import type { EditableMatch } from "@/components/admin/result-editor";
import type { Match } from "@/lib/data";
import type { Context } from "@/lib/data/context";
import { formatKickoff } from "@/lib/format";

export function editable(m: Match, ctx: Context): EditableMatch {
  return {
    id: m.id,
    home: ctx.teams.get(m.homeId)!.name,
    away: ctx.teams.get(m.awayId)!.name,
    when: `${ctx.seasonLabel(m.seasonId)}${m.matchday ? ` · Matchday ${m.matchday}` : ""} · ${formatKickoff(m, ctx.seasonLabel(m.seasonId))}`,
    status: m.status === "cancelled" ? "abandoned" : m.status,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    notes: m.notes,
  };
}
