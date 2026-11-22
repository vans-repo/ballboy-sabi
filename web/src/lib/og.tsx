import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReactNode } from "react";

import { SITE_NAME } from "@/config/site";

export const OG_SIZE = { width: 1200, height: 630 };
export const NAVY = "#000E2E";
export const SURFACE = "#00143C";
export const GOLD = "#F5C842";
export const AWAY = "#4A90D9";
export const GREY = "#64748B";

/** Barlow Condensed, bundled (OFL, see assets/fonts/OFL.txt) so images need no network. */
export async function ogFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [semi, heavy] = await Promise.all([
    readFile(join(dir, "BarlowCondensed-600.woff")),
    readFile(join(dir, "BarlowCondensed-800.woff")),
  ]);
  return [
    { name: "Barlow Condensed", data: semi, weight: 600 as const, style: "normal" as const },
    { name: "Barlow Condensed", data: heavy, weight: 800 as const, style: "normal" as const },
  ];
}

/** The frame every share image uses: navy, site name top left, a footer line. */
export function OgFrame({ children, footer }: { children: ReactNode; footer: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: NAVY,
        color: "white",
        fontFamily: "Barlow Condensed",
        padding: "48px 64px",
      }}
    >
      <div
        style={{ display: "flex", fontSize: 40, fontWeight: 800, color: GOLD, letterSpacing: 1 }}
      >
        {SITE_NAME.toUpperCase()}
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
      <div
        style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}
      >
        {footer}
      </div>
    </div>
  );
}

export function OgBadge({
  code,
  bg,
  fg,
  size = 120,
}: {
  code: string;
  bg: string;
  fg: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        background: bg,
        color: fg,
        fontSize: size * 0.36,
        fontWeight: 800,
      }}
    >
      {code}
    </div>
  );
}
