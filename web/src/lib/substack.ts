import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { SUBSTACK_URL } from "@/config/site";

export type Post = { title: string; url: string; date: string; excerpt: string };

/** One tag's text from an RSS <item>, without CDATA, HTML tags or common entities. */
export function field(item: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(item);
  const raw = (m?.[1] ?? "").replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim();
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

/**
 * The latest articles from the Substack's public RSS feed, newest first.
 * Cached for an hour. If the feed can't be read, the Home card just hides.
 */
export async function getLatestPosts(limit = 3): Promise<Post[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("substack");
  try {
    const r = await fetch(`${SUBSTACK_URL}/feed`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const xml = await r.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map(([, item]) => ({
      title: field(item, "title"),
      url: field(item, "link"),
      date: new Date(field(item, "pubDate")).toISOString(),
      excerpt: field(item, "description"),
    }));
  } catch {
    return [];
  }
}
