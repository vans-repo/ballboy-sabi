/** Fixture CSV: date, time, home, away, matchday (the admin import format). */

export type CsvRow = Record<string, string>;

/** A small RFC 4180 parser: commas, quotes, doubled quotes, CRLF. */
export function parseCsv(text: string): {
  header: string[];
  rows: { line: number; values: CsvRow }[];
} {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  const header = (records.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  const rows = records
    .map((r, i) => ({
      line: i + 2,
      values: Object.fromEntries(header.map((h, j) => [h, (r[j] ?? "").trim()])),
    }))
    .filter((r) => Object.values(r.values).some((v) => v !== ""));
  return { header, rows };
}

export const normaliseName = (raw: string) =>
  raw.toLowerCase().split(/\s+/).filter(Boolean).join(" ");

/** "2026-09-05" or "05/09/2026" -> [y, m, d], or null. */
export function parseDate(v: string): [number, number, number] | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  let ymd: [number, number, number] | null = m ? [+m[1], +m[2], +m[3]] : null;
  if (!ymd) {
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    ymd = m ? [+m[3], +m[2], +m[1]] : null;
  }
  if (!ymd) return null;
  const d = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2]));
  return d.getUTCFullYear() === ymd[0] &&
    d.getUTCMonth() === ymd[1] - 1 &&
    d.getUTCDate() === ymd[2]
    ? ymd
    : null;
}

/** "16:00" -> [16, 0], or null. */
export function parseTime(v: string): [number, number] | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? [+m[1], +m[2]] : null;
}

/** Lagos is UTC+1 all year (no daylight saving). */
export function lagosToUtc(
  [y, mo, d]: [number, number, number],
  [h, mi]: [number, number],
): string {
  return new Date(Date.UTC(y, mo - 1, d, h - 1, mi)).toISOString();
}

/** Upcoming matches with no announced time are stored at noon Lagos (see DECISIONS 50). */
export const UNANNOUNCED_TIME: [number, number] = [12, 0];
