import { BanButton } from "@/components/admin/forms";
import { Card, Empty, PageTitle } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getContext } from "@/lib/data/context";
import { formatShortDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Search by display name or email; view picks; ban or unban. */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const { q } = (await searchParams) as { q?: string };
  const query = (q ?? "").trim();
  const supabase = await createClient();

  // Emails live in auth.users, which only the service role can read.
  const emails = new Map<string, string>();
  if (query) {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
  }
  const byEmail = [...emails]
    .filter(([, e]) => e.toLowerCase().includes(query.toLowerCase()))
    .map(([id]) => id);
  const { data: profiles } = query
    ? await supabase
        .from("profiles")
        .select("id,display_name,role,banned,created_at")
        .or(
          `display_name.ilike.%${query.replace(/[%,()]/g, "")}%${byEmail.length ? `,id.in.(${byEmail.join(",")})` : ""}`,
        )
        .order("created_at")
        .limit(50)
    : { data: [] };
  const ids = (profiles ?? []).map((p) => p.id);
  const { data: picks } = ids.length
    ? await supabase
        .from("picks")
        .select("user_id,match_id,outcome,pred_home_goals,pred_away_goals,points_awarded")
        .in("user_id", ids)
    : { data: [] };
  const ctx = await getContext();
  const byId = new Map(ctx.matches.map((m) => [m.id, m]));

  return (
    <>
      <PageTitle>Users</PageTitle>
      <form action="/admin/users" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Display name or email"
          aria-label="Search users"
          className="h-11 flex-1 rounded-lg border bg-surface px-3 text-base"
        />
        <button
          type="submit"
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>
      {!query ? (
        <Empty>Search by display name or email.</Empty>
      ) : !profiles?.length ? (
        <Empty>No users match “{query}”.</Empty>
      ) : (
        <ul className="grid gap-3">
          {profiles.map((p) => {
            const mine = (picks ?? []).filter((k) => k.user_id === p.id);
            const total = mine.reduce((a, k) => a + (k.points_awarded ?? 0), 0);
            return (
              <li key={p.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {p.display_name}{" "}
                        {p.role !== "fan" && (
                          <span className="text-xs text-primary">({p.role})</span>
                        )}
                        {p.banned && <span className="ml-2 text-xs text-danger">Banned</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emails.get(p.id) ?? "email hidden"} · joined{" "}
                        {formatShortDate(p.created_at)} · {mine.length} picks, {total} points
                      </p>
                    </div>
                    {p.role === "fan" && <BanButton userId={p.id} banned={p.banned} />}
                  </div>
                  {mine.length > 0 && (
                    <details className="mt-2">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary">
                        View picks
                      </summary>
                      <ul className="grid gap-1 text-xs">
                        {mine
                          .map((k) => ({ k, m: byId.get(k.match_id) }))
                          .filter((x) => x.m)
                          .sort((a, b) => Date.parse(b.m!.kickoff) - Date.parse(a.m!.kickoff))
                          .map(({ k, m }) => (
                            <li key={k.match_id} className="flex justify-between gap-2">
                              <span>
                                {ctx.teams.get(m!.homeId)!.name} v {ctx.teams.get(m!.awayId)!.name}:{" "}
                                {k.outcome}
                                {k.pred_home_goals !== null &&
                                  ` ${k.pred_home_goals}–${k.pred_away_goals}`}
                              </span>
                              <span>{k.points_awarded ?? "–"}</span>
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
