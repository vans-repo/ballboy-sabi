import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { getContext } from "@/lib/data/context";
import { publicEnv } from "@/lib/env";

/** Main pages, every team, and every match of the current season. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.matches);
  const base = publicEnv.siteUrl;
  const ctx = await getContext();
  const pages = [
    "",
    "/fixtures",
    "/table",
    "/leaderboard",
    "/teams",
    "/h2h",
    "/accuracy",
    "/about",
  ].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const playing = new Set(ctx.matches.flatMap((m) => [m.homeId, m.awayId]));
  const teams = [...ctx.teams.values()]
    .filter((t) => playing.has(t.id))
    .map((t) => ({
      url: `${base}/team/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  const matches = ctx.matches
    .filter((m) => m.seasonId === ctx.current.id)
    .map((m) => ({
      url: `${base}/match/${m.id}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  return [...pages, ...teams, ...matches];
}
