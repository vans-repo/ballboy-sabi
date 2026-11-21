"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CalibrationPoint = {
  bucket: string;
  predicted: number;
  actual: number;
  matches: number;
};

/** Predicted vs actual home-win rate, per bucket. Lazy-loaded. */
export default function CalibrationChart({ points }: { points: CalibrationPoint[] }) {
  const data = points.map((p) => ({ ...p, predicted: p.predicted * 100, actual: p.actual * 100 }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fill: "var(--foreground-secondary)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "var(--foreground-secondary)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
          formatter={(v, name) => [`${Math.round(Number(v))}%`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="actual"
          name="Home teams actually won"
          fill="var(--away)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          dataKey="predicted"
          name="We predicted"
          stroke="var(--tnb-accent)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
