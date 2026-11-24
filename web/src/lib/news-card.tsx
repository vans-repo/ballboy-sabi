import "server-only";

import { ImageResponse } from "next/og";

import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/logo";
import { SITE_NAME, X_HANDLE } from "@/config/site";
import { formatShortDate } from "@/lib/format";
import type { SharedStory } from "@/lib/news-share";
import { GOLD, NAVY, ogFonts } from "@/lib/og";

export const NEWS_CARD_SIZE = { width: 1200, height: 630 };

/**
 * The share card for a news story (the image X shows under the post, and
 * "Save image"): the category's picture under a navy wash, a yellow edge,
 * the logo, the category and the headline. No club crests.
 */
export async function newsCard(s: SharedStory | null, init?: ResponseInit) {
  const title = s?.h.title ?? "NPFL news";
  const size = title.length > 110 ? 50 : title.length > 70 ? 60 : 72;
  const [, , lw, lh] = LOGO_VIEWBOX.split(" ").map(Number);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: NAVY,
        color: "white",
        fontFamily: "Barlow Condensed",
      }}
    >
      {s?.image && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered into the card image
        <img
          src={s.image.url}
          width={1200}
          height={630}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
          }}
        />
      )}
      {/* Navy wash: strong on the left where the text sits, lighter on the right. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage: `linear-gradient(90deg, ${NAVY} 0%, rgba(0,31,85,0.9) 45%, rgba(0,31,85,0.35) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 14,
          height: 630,
          display: "flex",
          background: GOLD,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 64px 44px 72px",
          width: 1200,
          height: 630,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={(40 * lw) / lh} height={40} viewBox={LOGO_VIEWBOX}>
            <path fill={GOLD} fillRule="evenodd" d={LOGO_PATH} />
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: GOLD }}>
            {SITE_NAME.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: GOLD,
              color: NAVY,
              fontSize: 26,
              fontWeight: 800,
              padding: "4px 14px",
              borderRadius: 6,
            }}
          >
            {(s?.label ?? "NPFL").toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: size, fontWeight: 800, lineHeight: 1.02 }}>
            {title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <div style={{ display: "flex" }}>
            {s ? `${s.h.source} · ${formatShortDate(s.h.date)}` : ""}
          </div>
          <div style={{ display: "flex", color: GOLD }}>{X_HANDLE}</div>
        </div>
      </div>
    </div>,
    { ...NEWS_CARD_SIZE, fonts: await ogFonts(), ...init },
  );
}
