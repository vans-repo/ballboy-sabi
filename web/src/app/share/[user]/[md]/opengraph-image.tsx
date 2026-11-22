import { ImageResponse } from "next/og";

import { FREE_TO_PLAY_LINE } from "@/config/site";
import { ordinal } from "@/lib/format";
import { GOLD, OG_SIZE, OgFrame, ogFonts, SURFACE } from "@/lib/og";
import { matchdayCard } from "@/lib/share";

export const alt = "A fan's Beat the Ballboy score for one matchday";
export const size = OG_SIZE;
export const contentType = "image/png";

/** "My Matchday": the fan's points and rank against The Ballboy. */
export default async function Image({ params }: { params: Promise<{ user: string; md: string }> }) {
  const { user, md } = await params;
  const card = await matchdayCard(user, Number(md));
  const fonts = await ogFonts();
  if (!card)
    return new ImageResponse(<OgFrame footer={FREE_TO_PLAY_LINE}> </OgFrame>, { ...size, fonts });
  const beat = card.ballboy ? card.me.points - card.ballboy.points : null;
  return new ImageResponse(
    <OgFrame footer={`Beat the Ballboy · ${card.season} · ${FREE_TO_PLAY_LINE}`}>
      <div
        style={{ display: "flex", fontSize: 56, fontWeight: 800 }}
      >{`${card.name}'s Matchday ${card.md}`}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 48, marginTop: 24 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{ display: "flex", fontSize: 180, fontWeight: 800, color: GOLD, lineHeight: 1 }}
          >
            {card.me.points}
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>points</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: SURFACE,
            borderRadius: 20,
            padding: "24px 32px",
            fontSize: 36,
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex" }}>{`${ordinal(card.me.rank)} of ${card.fans + 1}`}</div>
          <div
            style={{ display: "flex" }}
          >{`${card.me.correct} right · ${card.me.exact} exact`}</div>
          {card.ballboy && (
            <div style={{ display: "flex", color: beat! > 0 ? GOLD : "white" }}>
              {beat! > 0
                ? `Beat The Ballboy by ${beat}`
                : beat === 0
                  ? "Level with The Ballboy"
                  : `The Ballboy scored ${card.ballboy.points}`}
            </div>
          )}
        </div>
      </div>
    </OgFrame>,
    { ...size, fonts },
  );
}
