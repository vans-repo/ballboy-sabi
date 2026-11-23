import Link from "next/link";

import type { Team } from "@/lib/data";
import { cn } from "@/lib/utils";

const SIZE = { sm: "size-7", md: "size-9", lg: "size-16" } as const;

/**
 * The club's crest when one is uploaded and crests are switched on, else a
 * circle in the team's colour with its 3-letter code. Share images never use
 * crests.
 */
export function TeamBadge({ team, size = "md" }: { team: Team; size?: "sm" | "md" | "lg" }) {
  if (team.crest_url)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small public image from Supabase Storage
      <img
        src={team.crest_url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 object-contain", SIZE[size])}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "figure inline-flex shrink-0 items-center justify-center rounded-full leading-none",
        size === "sm" && "size-7 text-[0.7rem]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-16 text-xl",
      )}
      style={{ backgroundColor: team.primary_colour, color: team.secondary_colour }}
    >
      {team.code}
    </span>
  );
}

/** Badge and name, linking to the team's profile. */
export function TeamLink({
  team,
  size = "md",
  className,
  reverse = false,
}: {
  team: Team;
  size?: "sm" | "md" | "lg";
  className?: string;
  reverse?: boolean;
}) {
  return (
    <Link
      href={`/team/${team.slug}`}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 font-medium hover:underline",
        reverse && "flex-row-reverse text-right",
        className,
      )}
    >
      <TeamBadge team={team} size={size} />
      <span>{team.name}</span>
    </Link>
  );
}
