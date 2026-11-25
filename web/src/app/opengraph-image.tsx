import { ImageResponse } from "next/og";

import { FREE_SHORT } from "@/config/site";
import { GOLD, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";

export const alt = "NPFL match predictions and Beat the Ballboy, a free prediction game";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The default share image for pages without their own. */
export default async function Image() {
  return new ImageResponse(
    <OgFrame footer={FREE_SHORT}>
      <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1 }}>
        NPFL predictions
      </div>
      <div style={{ display: "flex", fontSize: 56, fontWeight: 600, color: GOLD, marginTop: 16 }}>
        Home, Draw and Away percentages for every match. Then try to beat The Ballboy.
      </div>
    </OgFrame>,
    { ...size, fonts: await ogFonts() },
  );
}
