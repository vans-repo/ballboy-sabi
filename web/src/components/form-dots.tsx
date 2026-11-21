import type { Result } from "@/lib/football";
import { cn } from "@/lib/utils";

const LABEL = { W: "won", D: "drew", L: "lost" } as const;

/** Last results, oldest first. Letters as well as colours, for accessibility. */
export function FormDots({ results }: { results: Result[] | string }) {
  const list = (typeof results === "string" ? results.split("") : results) as Result[];
  if (!list.length) return <span className="text-sm text-muted-foreground">No games yet</span>;
  return (
    <span
      className="inline-flex gap-1"
      role="img"
      aria-label={`Last ${list.length}, oldest first: ${list.map((r) => LABEL[r]).join(", ")}`}
    >
      {list.map((r, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "figure inline-flex size-5 items-center justify-center rounded-full text-[0.65rem] text-white",
            r === "W" && "bg-success text-background",
            r === "D" && "bg-draw",
            r === "L" && "bg-danger",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
