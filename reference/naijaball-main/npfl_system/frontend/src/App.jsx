import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg:          "#00143C",
  sidebar:     "#000E2E",
  card:        "rgba(255,255,255,0.04)",
  cardBorder:  "rgba(255,255,255,0.08)",
  text:        "#FFFFFF",
  textSub:     "rgba(255,255,255,0.60)",
  textMuted:   "rgba(255,255,255,0.38)",
  input:       "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.12)",
  divider:     "rgba(255,255,255,0.06)",
  gold:        "#F5C842",
  goldDim:     "rgba(245,200,66,0.10)",
  goldBorder:  "rgba(245,200,66,0.20)",
  rowAlt:      "rgba(255,255,255,0.03)",
  rowBorder:   "rgba(255,255,255,0.05)",
  green:       "#22C55E",
  blue:        "#4A90D9",
  red:         "#EF4444",
};

const FORM_C  = { W: "#22C55E", D: "#4A90D9", L: "#EF4444" };
const FORM_BG = { W: "rgba(34,197,94,0.15)", D: "rgba(74,144,217,0.15)", L: "rgba(239,68,68,0.15)" };

// ── HELPERS ───────────────────────────────────────────────────────────────────
function FormBadge({ r }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 5,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800,
      color: FORM_C[r] || T.textMuted,
      background: FORM_BG[r] || "rgba(128,128,128,0.15)",
      border: `1px solid ${FORM_C[r] ? FORM_C[r] + "33" : "transparent"}`,
    }}>{r}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 14, padding: 18, ...style,
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>
      Loading…
    </div>
  );
}

function APIError({ msg }) {
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 10, marginBottom: 14,
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      fontSize: 12, color: "#EF4444",
    }}>
      ⚠ {msg}
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "⊞", label: "Dashboard"    },
  { id: "predict",   icon: "⚡", label: "Predict"      },
  { id: "standings", icon: "🏆", label: "Standings"    },
  { id: "h2h",       icon: "↔", label: "Head-to-Head" },
];

// ── DASHBOARD PAGE ────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [error, setError]   = useState(null);

  useEffect(() => {
    api.stats().then(setStats).catch(e => setError(e.message));
  }, []);

  if (error) return <APIError msg={error} />;
  if (!stats) return <Spinner />;

  const statCards = [
    { label: "Matches in DB",  value: stats.total_matches.toLocaleString(), sub: "3 seasons · 2023–2026",   gold: true  },
    { label: "Model Accuracy", value: `${(stats.model_accuracy*100).toFixed(1)}%`, sub: "Random Forest · Test set", accent: true },
    { label: "Home Win Rate",  value: `${(stats.home_win_rate*100).toFixed(1)}%`,  sub: "All seasons · 2023–2026"  },
    { label: "Top Predictor",  value: "Travel Dist.", sub: `${(stats.top_feature_importance*100).toFixed(1)}% importance` },
  ];

  const fi = Object.entries(stats.feature_importance).sort((a,b) => b[1]-a[1]);
  const fiMax = fi[0][1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {statCards.map((c, i) => (
          <div key={i} style={{
            background: c.gold
              ? "linear-gradient(135deg,#F5C842,#D4A800)"
              : T.card,
            border: c.gold ? "none" : `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
              color: c.gold ? "rgba(0,20,60,0.65)" : T.textMuted, marginBottom: 6 }}>
              {c.label}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900,
              lineHeight: 1, color: c.gold ? "#00143C" : c.accent ? T.gold : T.text }}>
              {c.value}
            </div>
            <div style={{ fontSize: 10, marginTop: 5,
              color: c.gold ? "rgba(0,20,60,0.55)" : T.textMuted }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Feature importance */}
      <Card>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15,
          fontWeight: 700, color: T.text, marginBottom: 16 }}>
          Feature Importance — What the model weighs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fi.map(([name, val]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: T.textSub, width: 180, flexShrink: 0 }}>{name}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(128,128,128,0.15)" }}>
                <div style={{ width: `${(val/fiMax)*100}%`, height: "100%", borderRadius: 4,
                  background: name === "Travel_Distance_Km" ? T.gold : T.blue,
                  transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, width: 40, textAlign: "right",
                color: name === "Travel_Distance_Km" ? T.gold : T.text }}>
                {(val*100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── PREDICT PAGE ──────────────────────────────────────────────────────────────
function Predict({ teams }) {
  const [home,    setHome]    = useState("");
  const [away,    setAway]    = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (teams.length) { setHome(teams[0]); setAway(teams[1] || teams[0]); }
  }, [teams]);

  async function run() {
    if (!home || !away || home === away) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.predict(home, away);
      setResult(r);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sel = (label, val, onChange) => (
    <div>
      <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
        textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: 7 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select value={val} onChange={e => onChange(e.target.value)} style={{
          width: "100%", padding: "12px 36px 12px 14px",
          background: T.input, border: `1px solid ${T.inputBorder}`,
          borderRadius: 11, color: T.text, fontSize: 13, fontWeight: 600,
          fontFamily: "'Barlow',sans-serif", cursor: "pointer", outline: "none",
          appearance: "none",
        }}>
          {teams.map(t => <option key={t} style={{ background: T.sidebar }}>{t}</option>)}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%",
          transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }}>▾</span>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Card style={{ padding: 28 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20,
          fontWeight: 800, marginBottom: 22, color: T.text }}>Match Prediction Engine</div>

        {error && <APIError msg={error} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14,
          alignItems: "end", marginBottom: 20 }}>
          {sel("Home Team", home, setHome)}
          <div style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 2,
            background: T.goldDim, border: `1px solid ${T.goldBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: T.gold }}>VS</div>
          {sel("Away Team", away, setAway)}
        </div>

        <button onClick={run} disabled={!home || !away || home === away || loading} style={{
          width: "100%", padding: 13, border: "none", borderRadius: 11,
          background: (!home || !away || home === away || loading)
            ? "rgba(128,128,128,0.15)"
            : "linear-gradient(135deg,#F5C842,#D4A800)",
          color: (!home || !away || home === away || loading) ? T.textMuted : "#00143C",
          fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          cursor: (!home || !away || home === away || loading) ? "not-allowed" : "pointer",
        }}>
          {loading ? "Analysing…" : home === away ? "Select Different Teams" : "⚡ Run Prediction"}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            {(result.cold_start_home || result.cold_start_away) && (
              <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 12,
                background: T.goldDim, border: `1px solid ${T.goldBorder}` }}>
                <span style={{ fontSize: 11, color: T.gold }}>
                  ⚠ {result.cold_start_home ? result.home : result.away} — cold start defaults applied. Confidence is lower than usual.
                </span>
              </div>
            )}

            {/* Key stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Prediction",  val: result.prediction,               color: T.gold },
                { label: "Confidence",  val: `${(result.confidence*100).toFixed(1)}%`, color: T.text },
                { label: "Travel",      val: `${result.travel_km} km`,         color: T.text },
              ].map((c, i) => (
                <div key={i} style={{ padding: "13px 15px", borderRadius: 10,
                  background: T.goldDim, border: `1px solid ${T.goldBorder}` }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.textMuted,
                    textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18,
                    fontWeight: 800, color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Probability bar */}
            <div style={{ borderRadius: 9, overflow: "hidden", height: 36,
              display: "flex", marginBottom: 10 }}>
              {[
                { l: result.home, p: result.probabilities["Home Win"] || 0, c: "#22C55E" },
                { l: "Draw",      p: result.probabilities["Draw"]     || 0, c: "#64748B" },
                { l: result.away, p: result.probabilities["Away Win"] || 0, c: "#EF4444" },
              ].map((s, i) => (
                <div key={i} style={{
                  width: `${((s.p||0)*100).toFixed(1)}%`, background: s.c,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                  overflow: "hidden", padding: "0 4px",
                }}>
                  {s.p > 0.12 ? `${(s.p*100).toFixed(0)}%` : ""}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { l: result.home, p: result.probabilities["Home Win"] || 0, c: "#22C55E" },
                { l: "Draw",      p: result.probabilities["Draw"]     || 0, c: "#64748B" },
                { l: result.away, p: result.probabilities["Away Win"] || 0, c: "#EF4444" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                  <span style={{ color: T.textSub }}>{s.l}</span>
                  <span style={{ fontWeight: 700, color: T.text }}>{(s.p*100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── STANDINGS PAGE ────────────────────────────────────────────────────────────
function Standings() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.standings().then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <APIError msg={error} />;
  if (!data)  return <Spinner />;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 17, fontWeight: 700, color: T.text }}>
          2025/26 Final Table
        </span>
        <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: 1 }}>
          {data.rounds} ROUNDS COMPLETE
        </span>
      </div>
      <div style={{ display: "grid",
        gridTemplateColumns: "22px 1fr 30px 30px 30px 30px 40px 100px",
        gap: 5, padding: "0 8px 8px", borderBottom: `1px solid ${T.divider}`, marginBottom: 4 }}>
        {["#","Club","P","W","D","L","Pts","Form"].map(h => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, color: T.textMuted,
            letterSpacing: 1.2, textTransform: "uppercase",
            textAlign: h === "#" || h === "Club" ? "left" : "center" }}>{h}</span>
        ))}
      </div>
      {data.standings.map((t, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "22px 1fr 30px 30px 30px 30px 40px 100px",
          gap: 5, padding: "7px 8px", borderRadius: 7,
          background: i === 0 ? T.goldDim : "transparent",
          borderBottom: `1px solid ${T.divider}`,
          alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700,
            color: i < 3 ? T.gold : T.textMuted }}>{i+1}</span>
          <span style={{ fontSize: 11, fontWeight: i === 0 ? 700 : 500,
            color: T.text, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap" }}>{t.team}</span>
          {[t.p, t.w, t.d, t.l].map((v,j) => (
            <span key={j} style={{ fontSize: 11, color: T.textSub, textAlign: "center" }}>{v}</span>
          ))}
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15,
            fontWeight: 800, color: T.gold, textAlign: "center" }}>{t.pts}</span>
          <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
            {t.form.map((r, j) => <FormBadge key={j} r={r} />)}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── HEAD-TO-HEAD PAGE ─────────────────────────────────────────────────────────
function H2H({ teams }) {
  const [teamA,  setTeamA]  = useState("");
  const [teamB,  setTeamB]  = useState("");
  const [data,   setData]   = useState(null);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    if (teams.length) { setTeamA(teams[0]); setTeamB(teams[1] || teams[0]); }
  }, [teams]);

  async function load() {
    if (!teamA || !teamB || teamA === teamB) return;
    setLoading(true); setError(null); setData(null);
    try {
      const r = await api.h2h(teamA, teamB);
      setData(r);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sel = (label, val, onChange) => (
    <div>
      <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
        textTransform: "uppercase", color: T.textMuted, display: "block", marginBottom: 7 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select value={val} onChange={e => { onChange(e.target.value); setData(null); }} style={{
          width: "100%", padding: "12px 36px 12px 14px",
          background: T.input, border: `1px solid ${T.inputBorder}`,
          borderRadius: 11, color: T.text, fontSize: 13, fontWeight: 600,
          fontFamily: "'Barlow',sans-serif", cursor: "pointer", outline: "none", appearance: "none",
        }}>
          {teams.map(t => <option key={t} style={{ background: T.sidebar }}>{t}</option>)}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%",
          transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }}>▾</span>
      </div>
    </div>
  );

  const summary = data?.summary;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Card style={{ padding: 28 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20,
          fontWeight: 800, marginBottom: 22, color: T.text }}>Head-to-Head History</div>

        {error && <APIError msg={error} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14,
          alignItems: "end", marginBottom: 20 }}>
          {sel("First Team",  teamA, setTeamA)}
          <div style={{ width: 38, height: 38, borderRadius: 10, marginBottom: 2,
            background: T.goldDim, border: `1px solid ${T.goldBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: T.gold }}>VS</div>
          {sel("Second Team", teamB, setTeamB)}
        </div>

        <button onClick={load} disabled={!teamA || !teamB || teamA === teamB || loading} style={{
          width: "100%", padding: 13, border: "none", borderRadius: 11,
          background: (!teamA || !teamB || teamA === teamB || loading)
            ? "rgba(128,128,128,0.15)"
            : "linear-gradient(135deg,#F5C842,#D4A800)",
          color: (!teamA || !teamB || teamA === teamB || loading) ? T.textMuted : "#00143C",
          fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
          cursor: (!teamA || !teamB || teamA === teamB || loading) ? "not-allowed" : "pointer",
        }}>
          {loading ? "Loading…" : teamA === teamB ? "Select Different Teams" : "↔ Load H2H Record"}
        </button>

        {data && summary && (
          <div style={{ marginTop: 24 }}>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 40, fontWeight: 900, color: "#22C55E" }}>
                  {summary.home_wins}
                </div>
                <div style={{ fontSize: 11, color: T.textSub }}>{data.home}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 24, fontWeight: 700, color: T.textMuted }}>{summary.draws}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>DRAWS</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 40, fontWeight: 900, color: "#EF4444" }}>
                  {summary.away_wins}
                </div>
                <div style={{ fontSize: 11, color: T.textSub }}>{data.away}</div>
              </div>
            </div>

            {/* Matches */}
            {data.matches.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: T.textMuted, fontSize: 13 }}>
                No matches found between these teams in the dataset.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {data.matches.map((m, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "68px 1fr auto 1fr",
                    alignItems: "center", gap: 8, padding: "10px 14px",
                    borderRadius: 10, background: T.rowAlt, border: `1px solid ${T.rowBorder}`,
                  }}>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{m.Date}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, textAlign: "right",
                      color: T.text, overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}>{m.Home_Team}</span>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17,
                      fontWeight: 800, textAlign: "center", flexShrink: 0,
                      color: m.Outcome === "Draw" ? T.blue : T.gold }}>
                      {m.Home_Goals} – {m.Away_Goals}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.text,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}>{m.Away_Team}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active,  setActive]  = useState("dashboard");
  const [teams,   setTeams]   = useState([]);
  const [apiOk,   setApiOk]   = useState(null); // null=checking, true=ok, false=error
  const [sideOpen,setSideOpen]= useState(true);

  useEffect(() => {
    api.health()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
    api.teams()
      .then(d => setTeams(d.active || []))
      .catch(() => {});
  }, []);

  const PAGE_LABELS = {
    dashboard: "Dashboard",
    predict:   "Predict",
    standings: "2025/26 Standings",
    h2h:       "Head-to-Head",
  };

  const renderPage = () => {
    if (active === "dashboard") return <Dashboard />;
    if (active === "predict")   return <Predict teams={teams} />;
    if (active === "standings") return <Standings />;
    if (active === "h2h")       return <H2H teams={teams} />;
    return null;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; font-family: 'Barlow', sans-serif; color: ${T.text}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(245,200,66,0.35); border-radius: 4px; }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* SIDEBAR */}
        <aside style={{
          width: sideOpen ? 215 : 64, background: T.sidebar, flexShrink: 0,
          borderRight: "1px solid rgba(245,200,66,0.07)",
          display: "flex", flexDirection: "column", transition: "width 0.3s", overflow: "hidden",
        }}>
          <div style={{ padding: sideOpen ? "22px 18px 18px" : "22px 14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg,#F5C842,#D4A800)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 12, fontWeight: 900, color: "#00143C" }}>TNB</div>
            {sideOpen && (
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif",
                  fontSize: 17, fontWeight: 800, color: T.gold }}>NaijaBall</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)",
                  letterSpacing: 1.8, textTransform: "uppercase", marginTop: 2 }}>Analytics</div>
              </div>
            )}
          </div>

          <nav style={{ flex: 1, padding: "14px 10px", display: "flex",
            flexDirection: "column", gap: 3 }}>
            {NAV.map(n => {
              const isA = active === n.id;
              return (
                <button key={n.id} onClick={() => setActive(n.id)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: sideOpen ? "10px 12px" : "10px 0",
                  justifyContent: sideOpen ? "flex-start" : "center",
                  borderRadius: 9, border: "none",
                  borderLeft: `3px solid ${isA ? T.gold : "transparent"}`,
                  background: isA ? "rgba(245,200,66,0.14)" : "transparent",
                  color: isA ? T.gold : "rgba(255,255,255,0.5)",
                  fontFamily: "'Barlow',sans-serif", fontSize: 12,
                  fontWeight: isA ? 700 : 500, cursor: "pointer", width: "100%",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{n.icon}</span>
                  {sideOpen && <span>{n.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* API status dot */}
          {sideOpen && (
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10,
                color: apiOk === true ? "#22C55E" : apiOk === false ? "#EF4444" : T.textMuted }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%",
                  background: apiOk === true ? "#22C55E" : apiOk === false ? "#EF4444" : T.textMuted }} />
                {apiOk === true  ? "API connected" :
                 apiOk === false ? "API offline" : "Checking API…"}
              </div>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", background: T.bg }}>
          {/* Header */}
          <header style={{ height: 60, padding: "0 22px", display: "flex",
            alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${T.divider}`,
            background: "rgba(0,14,46,0.70)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setSideOpen(v => !v)} style={{
                background: T.input, border: `1px solid ${T.inputBorder}`,
                borderRadius: 8, width: 34, height: 34, color: T.text,
                fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>
              <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 20, fontWeight: 800, color: T.text }}>
                {PAGE_LABELS[active]}
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Amarpepe Adum</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>AFIT · U22/CS/1011</div>
              </div>
              <div style={{ width: 35, height: 35, borderRadius: 9,
                background: "linear-gradient(135deg,#F5C842,#D4A800)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#00143C" }}>AA</div>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex: 1, overflowY: "auto", padding: 22 }}>
            {apiOk === false && (
              <APIError msg="Cannot reach the API. Check that the Flask server is running and VITE_API_URL is set correctly." />
            )}
            {renderPage()}
          </main>
        </div>
      </div>
    </>
  );
}
