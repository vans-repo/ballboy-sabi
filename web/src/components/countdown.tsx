"use client";

import { formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/use-now";

/** "Picks lock in 2d 14h", ticking each minute. Renders nothing until mounted. */
export function Countdown({ to, prefix }: { to: string; prefix: string }) {
  const now = useNow(30_000);
  if (now === null) return null;
  const left = Date.parse(to) - now;
  return <span>{left > 0 ? `${prefix} ${formatCountdown(left)}` : "Picks locked"}</span>;
}
