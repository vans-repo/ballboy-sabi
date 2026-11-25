import { ImageResponse } from "next/og";

import { FREE_SHORT } from "@/config/site";
import { getFrozenPredictions, getLatestPredictions } from "@/lib/data";
import { getContext } from "@/lib/data/context";
import { hasResult } from "@/lib/football";
import { formatDay, formatKickoffTime } from "@/lib/format";
import { AWAY, GOLD, GREY, OG_SIZE, OgBadge, OgFrame, ogFonts, SURFACE } from "@/lib/og";

export const alt = "Match prediction: Home, Draw and Away percentages";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Share image for a match: teams, the three percentages, and a One To Watch banner when it has an Upset Alert. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const m = ctx.matches.find((x) => x.id === id);
  const fonts = await ogFonts();
  if (!m) return new ImageResponse(<OgFrame footer={FREE_SHORT}> </OgFrame>, { ...size, fonts });

  const [latest, frozen] = await Promise.all([getLatestPredictions(), getFrozenPredictions()]);
  const p = latest[m.id] ?? frozen[m.id];
  const home = ctx.teams.get(m.homeId)!;
  const away = ctx.teams.get(m.awayId)!;
  const played = hasResult(m);
  const upset = !played && p?.upset_alert;
  const when = m.kickoffEstimated
    ? `${ctx.seasonLabel(m.seasonId)} season`
    : played || m.status !== "scheduled"
      ? formatDay(m.kickoff)
      : `${formatDay(m.kickoff)} · ${formatKickoffTime(m)}`;
  const parts = p
    ? [
        { label: "HOME", value: Math.round(Number(p.p_home) * 100), color: GOLD },
        { label: "DRAW", value: Math.round(Number(p.p_draw) * 100), color: "white" },
        { label: "AWAY", value: Math.round(Number(p.p_away) * 100), color: AWAY },
      ]
    : [];

  return new ImageResponse(
    <OgFrame footer={`${m.matchday ? `Matchday ${m.matchday} · ` : ""}${when} · ${FREE_SHORT}`}>
      {upset && (
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: AWAY,
            color: "white",
            fontSize: 32,
            fontWeight: 800,
            padding: "6px 18px",
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          ONE TO WATCH
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, width: 460 }}>
          <OgBadge code={home.code} bg={home.primary_colour} fg={home.secondary_colour} />
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
            {home.name}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: played ? 96 : 44,
            fontWeight: 800,
            color: played ? "white" : GREY,
          }}
        >
          {played ? `${m.homeGoals}–${m.awayGoals}` : "v"}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            width: 460,
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1,
              textAlign: "right",
            }}
          >
            {away.name}
          </div>
          <OgBadge code={away.code} bg={away.primary_colour} fg={away.secondary_colour} />
        </div>
      </div>
      {parts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            background: SURFACE,
            borderRadius: 20,
            padding: "24px 32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {parts.map((x) => (
              <div
                key={x.label}
                style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 26,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {x.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 88,
                    fontWeight: 800,
                    color: x.color,
                    lineHeight: 1,
                  }}
                >
                  {x.value}%
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              height: 14,
              borderRadius: 14,
              overflow: "hidden",
              marginTop: 16,
            }}
          >
            <div style={{ width: `${parts[0].value}%`, background: GOLD }} />
            <div style={{ width: `${parts[1].value}%`, background: GREY }} />
            <div style={{ width: `${parts[2].value}%`, background: AWAY }} />
          </div>
        </div>
      )}
    </OgFrame>,
    { ...size, fonts },
  );
}
