import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { NEWS_FEEDS, NEWS_KEYWORDS } from "@/config/news";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getContext } from "@/lib/data/context";
import { field } from "@/lib/substack";

export type Headline = { title: string; url: string; date: string; source: string };
export type FeedStatus = { name: string; ok: boolean; items: number; matched: number };

const WEEK_MS = 7 * 86_400_000;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * NPFL headlines from the last seven days, newest first, at most one story
 * per normalised title. Cached for an hour. Every feed is optional: a slow
 * or broken one is skipped, and if none work the Home card hides.
 */
export async function getLeagueNews(): Promise<{ headlines: Headline[]; feeds: FeedStatus[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  const ctx = await getContext();
  // League words, plus the current clubs' names ("Enugu Rangers", not just "Rangers").
  const current = new Set(
    ctx.matches.filter((m) => m.seasonId === ctx.current.id).flatMap((m) => [m.homeId, m.awayId]),
  );
  const words = [
    ...NEWS_KEYWORDS,
    ...[...current].map((id) => ctx.teams.get(id)?.name).filter((n): n is string => !!n),
    "3SC",
    "Rangers International",
  ];
  const match = new RegExp(`\\b(${words.map(escape).join("|")})\\b`, "i");
  const since = Date.now() - WEEK_MS;

  const results = await Promise.all(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "BallboySabi/1.0 (+news headlines)" },
        });
        if (!r.ok) return { feed, ok: false, items: [] as Headline[], total: 0 };
        const xml = await r.text();
        const all = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
          title: field(item, "title"),
          url: field(item, "link"),
          date: field(item, "pubDate"),
          text: `${field(item, "title")} ${field(item, "description")}`,
        }));
        const items = all
          .filter((i) => i.title && /^https:\/\//.test(i.url) && match.test(i.text))
          .map((i) => ({ ...i, time: Date.parse(i.date) }))
          .filter((i) => Number.isFinite(i.time) && i.time >= since)
          .map((i) => ({
            title: i.title,
            url: i.url,
            date: new Date(i.time).toISOString(),
            source: feed.name,
          }));
        return { feed, ok: true, items, total: all.length };
      } catch {
        return { feed, ok: false, items: [] as Headline[], total: 0 };
      }
    }),
  );

  const seen = new Set<string>();
  const headlines = results
    .flatMap((r) => r.items)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((h) => {
      const key = h.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    headlines,
    feeds: results.map((r) => ({
      name: r.feed.name,
      ok: r.ok,
      items: r.total,
      matched: r.items.length,
    })),
  };
}
