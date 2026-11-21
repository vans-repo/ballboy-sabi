"use client";

import dynamic from "next/dynamic";

const placeholder = (height: number) =>
  function ChartLoading() {
    return <div className="animate-pulse rounded-lg bg-muted" style={{ height }} />;
  };

/** Charts load only on the pages that show them, after the page itself. */
export const LazyRatingChart = dynamic(() => import("./rating-chart"), {
  ssr: false,
  loading: placeholder(220),
});
export const LazyCalibrationChart = dynamic(() => import("./calibration-chart"), {
  ssr: false,
  loading: placeholder(240),
});
