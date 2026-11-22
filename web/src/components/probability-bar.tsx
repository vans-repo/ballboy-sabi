import type { Prediction } from "@/lib/data";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Probs = Pick<Prediction, "p_home" | "p_draw" | "p_away">;

/** Home / Draw / Away as numbers and as a bar. All three are always shown. */
export function ProbabilityBar({ p, size = "md" }: { p: Probs; size?: "md" | "lg" }) {
  const parts = [
    { label: "Home", value: p.p_home, bar: "bg-home", text: "text-primary" },
    { label: "Draw", value: p.p_draw, bar: "bg-draw", text: "" },
    { label: "Away", value: p.p_away, bar: "bg-away", text: "text-away" },
  ];
  return (
    <div>
      <dl className="grid grid-cols-3 text-center">
        {parts.map((x) => (
          <div key={x.label}>
            <dt className="text-xs text-muted-foreground">{x.label}</dt>
            <dd className={cn("figure", size === "lg" ? "text-5xl" : "text-2xl", x.text)}>
              {pct(x.value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
        {parts.map((x) => (
          <div key={x.label} className={x.bar} style={{ width: pct(x.value) }} />
        ))}
      </div>
    </div>
  );
}
