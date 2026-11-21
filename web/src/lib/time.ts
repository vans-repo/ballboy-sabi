/**
 * The time a cached page was rendered. Pages that depend on "now" (which
 * matchday is current, which matches are locked) are cached for a minute
 * (cacheLife "minutes"), so this is at most a minute or two old. Countdowns
 * that must tick run in the browser instead (components/countdown.tsx).
 */
export function renderTime(): number {
  return Date.now();
}
