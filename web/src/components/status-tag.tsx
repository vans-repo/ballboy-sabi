import type { MatchStatus } from "@/lib/data";

const TEXT: Partial<Record<MatchStatus, string>> = {
  postponed: "Postponed",
  abandoned: "Abandoned",
  awarded: "Awarded",
  cancelled: "Cancelled",
};

export function StatusTag({ status }: { status: MatchStatus }) {
  const text = TEXT[status];
  if (!text) return null;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{text}</span>;
}
