"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RatingPoint = { i: number; elo: number; season: string };

/** Elo after every match, across all seasons. Lazy-loaded (see lazy-charts.tsx). */
export default function RatingChart({ points }: { points: RatingPoint[] }) {
  const starts = points.filter((p, i) => i === 0 || p.season !== points[i - 1].season);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="i"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={starts.map((s) => s.i)}
          tickFormatter={(i: number) => starts.find((s) => s.i === i)?.season.slice(2) ?? ""}
          tick={{ fill: "var(--foreground-secondary)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <YAxis
          domain={["dataMin - 20", "dataMax + 20"]}
          allowDecimals={false}
          tickFormatter={(v: number) => String(Math.round(v))}
          tick={{ fill: "var(--foreground-secondary)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
          labelFormatter={(_, payload) =>
            (payload?.[0]?.payload as RatingPoint | undefined)?.season ?? ""
          }
          formatter={(v) => [Math.round(Number(v)), "Rating"]}
        />
        <Line
          type="monotone"
          dataKey="elo"
          stroke="var(--tnb-accent)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
