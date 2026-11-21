/**
 * api.js
 * All fetch calls to the Flask backend in one place.
 * BASE_URL is set via the VITE_API_URL environment variable on Vercel.
 * During local dev, Vite's proxy forwards /api → http://localhost:5000
 */

const BASE = import.meta.env.VITE_API_URL || "";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  health:    ()           => get("/api/health"),
  teams:     ()           => get("/api/teams"),
  standings: ()           => get("/api/standings"),
  stats:     ()           => get("/api/stats"),
  predict:   (home, away) => post("/api/predict", { home, away }),
  h2h:       (home, away) => get(`/api/h2h?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`),
};
