/**
 * YouTube channels the league has authorised to stream NPFL matches,
 * confirmed by the site owner. Only videos from these channels are linked
 * or suggested. Keyed by season label; `search` is the channel used for the
 * "Find on YouTube" link when a match has no video set.
 */
export const OFFICIAL_CHANNELS: Record<string, { handles: string[]; search: string }> = {
  "2026/27": { handles: ["@MBI_Sport", "@NigeriaPFL"], search: "@NigeriaPFL" },
  "2025/26": { handles: ["@NPFLLive"], search: "@NPFLLive" },
};
