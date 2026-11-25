import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Empty, PageTitle } from "@/components/section";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getViewer } from "@/lib/auth/user";
import { getLeaderboard, type LeaderRow, type LeaderScope } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { renderTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Beat the Ballboy: the fans who out-picked the Ballboy this matchday, this season and of all time.",
  alternates: { canonical: "/leaderboard" },
};

const PAGE_SIZE = 50;
const TABS: { key: LeaderScope; label: string }[] = [
  { key: "matchday", label: "This Matchday" },
  { key: "season", label: "Season" },
  { key: "all", label: "All-time" },
];
type Search = { tab?: string; page?: string };

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <Suspense fallback={<PageTitle>Leaderboard</PageTitle>}>
      <FromSearch searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function FromSearch({ searchParams }: { searchParams: Promise<Search> }) {
  const { tab, page } = await searchParams;
  const scope = (TABS.find((t) => t.key === tab)?.key ?? "season") as LeaderScope;
  const n = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const target = await resolveScope(scope);
  return (
    <Board scope={scope} page={n} target={target}>
      <Suspense>
        <MyRow scope={scope} id={target.id} page={n} />
      </Suspense>
    </Board>
  );
}

/** Which matchday or season a tab means: the latest matchday that has kicked off. */
async function resolveScope(scope: LeaderScope): Promise<{ id: string | null; label: string }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches);
  const now = renderTime();
  const ctx = await getContext();
  if (scope === "all") return { id: null, label: "All seasons since launch" };
  if (scope === "season") return { id: ctx.current.id, label: `${ctx.current.label} season` };
  const started = ctx.matches
    .filter((m) => m.seasonId === ctx.current.id && m.matchdayId && Date.parse(m.kickoff) <= now)
    .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff))[0];
  return started
    ? { id: started.matchdayId, label: `Matchday ${started.matchday}` }
    : { id: null, label: "No matchday yet" };
}

function href(scope: LeaderScope, page: number) {
  return `/leaderboard?tab=${scope}${page > 1 ? `&page=${page}` : ""}`;
}

async function Board({
  scope,
  page,
  target,
  children,
}: {
  scope: LeaderScope;
  page: number;
  target: { id: string | null; label: string };
  children: React.ReactNode;
}) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.matches, CACHE_TAGS.picks);
  const rows = scope !== "all" && !target.id ? [] : await getLeaderboard(scope, target.id);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ballboy = rows.find((r) => r.isBallboy);
  const pinBallboy = ballboy && !visible.includes(ballboy);
  const hasFans = rows.some((r) => !r.isBallboy);

  return (
    <>
      <PageTitle sub={target.label}>Leaderboard</PageTitle>
      <nav
        aria-label="Leaderboard"
        className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1"
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, 1)}
            aria-current={t.key === scope ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg text-sm font-medium",
              t.key === scope ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {!hasFans ? (
        <Empty>
          No scores yet. The leaderboard fills in once picks are scored after each result.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Leaderboard, {target.label}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="w-12 py-2 pl-3 text-left font-medium">
                  Rank
                </th>
                <th scope="col" className="py-2 text-left font-medium">
                  Name
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Pts
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  <abbr title="Correct outcomes" className="no-underline">
                    Correct
                  </abbr>
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  <abbr title="Exact scores" className="no-underline">
                    Exact
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {pinBallboy && <Row r={ballboy} pinned />}
              {visible.map((r) => (
                <Row key={r.userId} r={r} />
              ))}
              {children}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={href(scope, page - 1)}
              className="inline-flex h-11 items-center px-3 text-ink"
            >
              ‹ Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link
              href={href(scope, page + 1)}
              className="inline-flex h-11 items-center px-3 text-ink"
            >
              Next ›
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Ties go to more exact scores, then more correct away picks, then the earlier sign-up.
      </p>
    </>
  );
}

function Row({ r, pinned, mine }: { r: LeaderRow; pinned?: boolean; mine?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b last:border-0",
        r.isBallboy && "bg-primary/10",
        mine && "bg-away/15",
        pinned && "border-b-4",
      )}
    >
      <td className="figure py-2 pl-3 text-base">{r.rank}</td>
      <td className="py-2">
        <span className="font-medium">{r.name}</span>
        {r.isBallboy && <span className="ml-2 text-xs text-ink">To beat</span>}
        {mine && <span className="ml-2 text-xs text-away">You</span>}
      </td>
      <td className="figure px-2 py-2 text-right text-base">{r.points}</td>
      <td className="px-2 py-2 text-right">{r.correct}</td>
      <td className="py-2 pr-3 text-right">{r.exact}</td>
    </tr>
  );
}

/** The signed-in fan's row, pinned at the bottom when it isn't on this page. */
async function MyRow({ scope, id, page }: { scope: LeaderScope; id: string | null; page: number }) {
  await connection();
  const viewer = await getViewer();
  if (!viewer || (scope !== "all" && !id)) return null;
  const rows = await getLeaderboard(scope, id);
  const me = rows.find((r) => r.userId === viewer.id);
  if (!me) return null;
  const onPage = me.rank > (page - 1) * PAGE_SIZE && me.rank <= page * PAGE_SIZE;
  return onPage ? null : <Row r={me} mine />;
}
