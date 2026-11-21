"use client";

import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/format";

/** "Picks lock in 2d 14h", ticking each minute. Renders nothing until mounted. */
export function Countdown({ to, prefix }: { to: string; prefix: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick on mount
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const left = Date.parse(to) - now;
  return <span>{left > 0 ? `${prefix} ${formatCountdown(left)}` : "Picks locked"}</span>;
}
