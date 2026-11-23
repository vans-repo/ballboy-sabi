import "server-only";

import { ImageResponse } from "next/og";

import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/logo";
import { FREE_TO_PLAY_LINE, SITE_NAME, X_HANDLE } from "@/config/site";
import { publicEnv } from "@/lib/env";
import { formatDay, formatKickoffTime } from "@/lib/format";
import type { Motw } from "@/lib/motw";
import { AWAY, GOLD, GREY, NAVY, ogFonts, SURFACE } from "@/lib/og";

/*
 * Match of the Week images. Team colours and three-letter codes only, never
 * crests: these travel on X and Instagram.
 *
 *   poster  1080×1350  "Save image" (Instagram, WhatsApp, X)
 *   card    1200×630   the link preview X shows under a post
 */

export const POSTER_SIZE = { width: 1080, height: 1350 };
export const CARD_SIZE = { width: 1200, height: 630 };

const siteHost = () => new URL(publicEnv.siteUrl).host;
const n = (p: number | string) => Math.round(Number(p) * 100);

function Logo({ height }: { height: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(" ").map(Number);
  return (
    <svg width={(height * w) / h} height={height} viewBox={LOGO_VIEWBOX}>
      <path fill={GOLD} fillRule="evenodd" d={LOGO_PATH} />
    </svg>
  );
}

function Brand({ scale }: { scale: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 * scale }}>
      <Logo height={48 * scale} />
      <div style={{ display: "flex", fontSize: 44 * scale, fontWeight: 800, color: GOLD }}>
        {SITE_NAME.toUpperCase()}
      </div>
    </div>
  );
}

const OUTLINE = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

/** Two team-colour bands with the codes overlapping, the away code in outline. */
function Codes({
  w,
  h,
  font,
  shift,
  homeBg,
  awayBg,
  homeCode,
  awayCode,
}: {
  w: number;
  h: number;
  font: number;
  shift: number;
  homeBg: string;
  awayBg: string;
  homeCode: string;
  awayCode: string;
}) {
  const code = {
    display: "flex",
    fontSize: font,
    fontWeight: 800,
    lineHeight: 0.8,
    letterSpacing: -font * 0.025,
  } as const;
  const stroke = Math.max(3, Math.round(font / 60));
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h }}>
      <div style={{ display: "flex", flex: 1, background: homeBg }} />
      <div style={{ display: "flex", flex: 1, background: awayBg }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ ...code, color: "white", marginLeft: -shift * 2 }}>{homeCode}</div>
        {/* The image renderer has no text outline: stack white copies behind a band-coloured fill. */}
        <div style={{ display: "flex", position: "relative", marginLeft: shift * 2 }}>
          {OUTLINE.map(([dx, dy]) => (
            <div
              key={`${dx},${dy}`}
              style={{
                ...code,
                position: "absolute",
                top: dy * stroke,
                left: dx * stroke,
                color: "white",
              }}
            >
              {awayCode}
            </div>
          ))}
          <div style={{ ...code, color: awayBg }}>{awayCode}</div>
        </div>
      </div>
    </div>
  );
}

function Bar({
  p,
  height,
  label,
  value,
}: {
  p: [number, number, number];
  height: number;
  label: number;
  value: number;
}) {
  const parts = [
    { name: "HOME", v: p[0], bg: GOLD, fg: NAVY },
    { name: "DRAW", v: p[1], bg: GREY, fg: "white" },
    { name: "AWAY", v: p[2], bg: AWAY, fg: NAVY },
  ];
  return (
    <div style={{ display: "flex", height, borderRadius: 16, overflow: "hidden", width: "100%" }}>
      {parts.map((x) => (
        <div
          key={x.name}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: x.bg,
            color: x.fg,
            flexGrow: Math.max(x.v, 18),
            flexBasis: 0,
            padding: "0 20px",
          }}
        >
          <div style={{ display: "flex", fontSize: label, fontWeight: 800 }}>{x.name}</div>
          <div style={{ display: "flex", fontSize: value, fontWeight: 800, lineHeight: 0.95 }}>
            {`${x.v}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ text, size }: { text: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        background: AWAY,
        color: NAVY,
        fontSize: size,
        fontWeight: 800,
        padding: `${size * 0.2}px ${size * 0.55}px`,
        borderRadius: size * 0.25,
      }}
    >
      {text}
    </div>
  );
}

function headline(w: Motw): string[] {
  if (w.kind === "match") return ["MATCH OF", "THE WEEK"];
  if (w.kind === "recap") return ["THE BALLBOY'S", "WEEK"];
  return ["BEAT THE", "BALLBOY"];
}

function labelText(w: Motw): string | null {
  if (w.kind !== "match") return null;
  return w.label === "upset" ? "UPSET ALERT" : w.label === "closest" ? "CLOSEST CALL" : null;
}

function whenText(w: Extract<Motw, { kind: "match" }>) {
  return `${formatDay(w.match.kickoff)} · ${formatKickoffTime(w.match)}`;
}

const frame = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  background: NAVY,
  color: "white",
  fontFamily: "Barlow Condensed",
} as const;

function Poster({ w }: { w: Motw }) {
  const pad = 72;
  return (
    <div style={frame}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `64px ${pad}px 0`,
        }}
      >
        <Brand scale={1} />
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {w.kind === "start" ? "NPFL" : `NPFL · MATCHDAY ${w.md}`}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 132,
          fontWeight: 800,
          lineHeight: 0.85,
          padding: `40px ${pad}px 0`,
          height: 310,
        }}
      >
        {headline(w).map((line) => (
          <div key={line} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>

      {w.kind === "match" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", position: "relative" }}>
            <Codes
              w={1080}
              h={430}
              font={270}
              shift={55}
              homeBg={w.home.primary_colour}
              awayBg={w.away.primary_colour}
              homeCode={w.home.code}
              awayCode={w.away.code}
            />
            {labelText(w) && (
              <div style={{ display: "flex", position: "absolute", top: -30, right: pad }}>
                <Pill text={labelText(w)!} size={40} />
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 46,
              fontWeight: 600,
              padding: `28px ${pad}px 0`,
            }}
          >
            <div style={{ display: "flex" }}>{w.home.name.toUpperCase()}</div>
            <div style={{ display: "flex" }}>{w.away.name.toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", padding: `24px ${pad}px 0` }}>
            <Bar
              p={[n(w.p.p_home), n(w.p.p_draw), n(w.p.p_away)]}
              height={128}
              label={22}
              value={68}
            />
          </div>
          <div
            style={{ display: "flex", fontSize: 34, fontWeight: 600, padding: `26px ${pad}px 0` }}
          >
            {`${whenText(w)} · Can you beat the Ballboy?`}
          </div>
        </div>
      )}

      {w.kind === "recap" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 48,
              height: 430,
              background: GOLD,
              color: NAVY,
              padding: `0 ${pad}px`,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 330,
                fontWeight: 800,
                lineHeight: 0.8,
                letterSpacing: -8,
              }}
            >
              {`${w.right}/${w.total}`}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 0.95,
              }}
            >
              <div style={{ display: "flex" }}>{`MATCHDAY ${w.md}`}</div>
              <div style={{ display: "flex" }}>RESULTS</div>
              <div style={{ display: "flex" }}>CALLED RIGHT</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: `40px ${pad}px 0` }}>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 14,
              }}
            >
              TOP OF THE TABLE
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {w.top.map((t, i) => (
                <div
                  key={t.team.id}
                  style={{
                    display: "flex",
                    flex: 1,
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: SURFACE,
                    borderRadius: 16,
                    padding: "18px 24px",
                    borderLeft: `8px solid ${i === 0 ? GOLD : AWAY}`,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
                    {`${t.position} ${t.team.name.toUpperCase()}`}
                  </div>
                  <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>{t.points}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{ display: "flex", fontSize: 34, fontWeight: 600, padding: `40px ${pad}px 0` }}
          >
            Can you beat the Ballboy next matchday?
          </div>
        </div>
      )}

      {w.kind === "start" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
            height: 600,
            background: GOLD,
            color: NAVY,
            padding: `0 ${pad}px`,
          }}
        >
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 0.95 }}>
            PICK HOME, DRAW OR AWAY
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 0.95 }}>
            FOR EVERY NPFL MATCH.
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600 }}>
            Score more for the results the model thought unlikely.
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: pad,
          right: pad,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 30,
          fontWeight: 600,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        <div style={{ display: "flex" }}>{FREE_TO_PLAY_LINE}</div>
        <div style={{ display: "flex", color: GOLD }}>{`${siteHost()} · ${X_HANDLE}`}</div>
      </div>
    </div>
  );
}

function Card({ w }: { w: Motw }) {
  return (
    <div style={{ ...frame, flexDirection: "row" }}>
      {w.kind === "match" ? (
        <Codes
          w={560}
          h={630}
          font={220}
          shift={30}
          homeBg={w.home.primary_colour}
          awayBg={w.away.primary_colour}
          homeCode={w.home.code}
          awayCode={w.away.code}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 560,
            height: 630,
            background: GOLD,
            color: NAVY,
          }}
        >
          {w.kind === "recap" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 230,
                  fontWeight: 800,
                  lineHeight: 0.85,
                  letterSpacing: -6,
                }}
              >
                {`${w.right}/${w.total}`}
              </div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>CALLED RIGHT</div>
            </div>
          ) : (
            <svg width={400} height={142} viewBox={LOGO_VIEWBOX}>
              <path fill={NAVY} fillRule="evenodd" d={LOGO_PATH} />
            </svg>
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Brand scale={0.72} />
          {labelText(w) && <Pill text={labelText(w)!} size={26} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {w.kind === "start" ? "NPFL" : `NPFL · MATCHDAY ${w.md}`}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 0.85,
              marginTop: 8,
            }}
          >
            {headline(w).map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, marginTop: 16 }}>
            {w.kind === "match"
              ? `${w.home.name} v ${w.away.name}`
              : w.kind === "recap"
                ? `Matchday ${w.md}: ${w.right} of ${w.total} results called right`
                : "Free NPFL predictions game"}
          </div>
          {w.kind === "match" && (
            <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.75)" }}>
              {whenText(w)}
            </div>
          )}
        </div>
        {w.kind === "match" ? (
          <Bar
            p={[n(w.p.p_home), n(w.p.p_draw), n(w.p.p_away)]}
            height={84}
            label={15}
            value={44}
          />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.75)" }}>
          {`${FREE_TO_PLAY_LINE} · ${X_HANDLE}`}
        </div>
      </div>
    </div>
  );
}

export async function motwPoster(w: Motw, init?: ResponseInit) {
  return new ImageResponse(<Poster w={w} />, { ...POSTER_SIZE, fonts: await ogFonts(), ...init });
}

export async function motwCard(w: Motw) {
  return new ImageResponse(<Card w={w} />, { ...CARD_SIZE, fonts: await ogFonts() });
}
