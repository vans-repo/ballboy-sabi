import { DISPLAY_TIME_ZONE } from "@/config/site";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const longDayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Kickoff = { kickoff: string; kickoffEstimated: boolean; timeConfirmed: boolean };

/** "Sat 21 Nov" */
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
/** "Saturday 21 November 2026" */
export const formatLongDay = (iso: string) => longDayFmt.format(new Date(iso));
/** "16:00" (WAT) */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
/** "21 Nov 2026" */
export const formatShortDate = (iso: string) => shortDateFmt.format(new Date(iso));

/** Kick-off as fans should see it: never a placeholder time or an estimated date. */
export function formatKickoff(m: Kickoff, seasonLabel?: string): string {
  if (m.kickoffEstimated) return seasonLabel ? `${seasonLabel} season` : "Date not recorded";
  if (!m.timeConfirmed) return formatDay(m.kickoff);
  return `${formatDay(m.kickoff)}, ${formatTime(m.kickoff)}`;
}

/** Upcoming kick-off time line: "16:00 WAT" or "Time TBC". */
export function formatKickoffTime(m: Kickoff): string {
  return m.timeConfirmed ? `${formatTime(m.kickoff)} WAT` : "Time TBC";
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${s}`;
}

/** 0.65 -> "65%" */
export const pct = (p: number | string) => `${Math.round(Number(p) * 100)}%`;

/** "2d 14h", "5h 20m", "12m" */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
