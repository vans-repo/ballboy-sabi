import { OFFICIAL_CHANNELS } from "@/config/youtube";

/** The video id in a YouTube link (watch, youtu.be, live, shorts or embed), or null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host !== "youtube.com") return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = /^\/(live|shorts|embed)\/([\w-]{6,})/.exec(u.pathname);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

/** A clean watch link, or null if it isn't a YouTube video link. */
export function normaliseYoutube(url: string): string | null {
  const id = youtubeId(url.trim());
  return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

/**
 * "Find on YouTube": a search for the match on the season's official
 * channel, or on YouTube as a whole for seasons with no channel on record.
 */
export function youtubeSearch(home: string, away: string, seasonLabel: string): string {
  const q = encodeURIComponent(`${home} vs ${away}`);
  const ch = OFFICIAL_CHANNELS[seasonLabel]?.search;
  return ch
    ? `https://www.youtube.com/${ch}/search?query=${q}`
    : `https://www.youtube.com/results?search_query=${q}%20NPFL`;
}

export const VIDEO_LABEL = {
  live: "Watch live",
  highlights: "Watch highlights",
  replay: "Watch the full match",
} as const;
export type VideoLabel = keyof typeof VIDEO_LABEL;
