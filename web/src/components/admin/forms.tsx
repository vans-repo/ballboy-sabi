"use client";

import { useState, useTransition } from "react";

import {
  type ActionResult,
  addAlias,
  addDeduction,
  addFixture,
  createSeason,
  deleteAlias,
  deleteDeduction,
  previewImport,
  removeCrest,
  runModelNow,
  saveImport,
  saveSeasonTeams,
  sendTestPreview,
  setBanned,
  setCurrentSeason,
  setMotwOverride,
  setShowCrests,
  updateFixture,
  updateTeam,
  uploadCrest,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { trackRun } from "@/lib/admin/run-store";
import { suggestColours } from "@/lib/crest-colours";
import type { PreviewRow } from "@/lib/admin/fixtures";

const input = "h-11 rounded-lg border bg-background px-3 text-base";

/** Runs a server action and keeps its message. */
function useAct() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(null);
      try {
        setResult(await fn());
      } catch {
        setResult({ error: "That didn't work. Refresh the page and try again." });
      }
    });
  return { pending, result, run };
}

function Message({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <>
      {result.error && (
        <p role="alert" className="text-sm text-danger">
          {result.error}
        </p>
      )}
      {result.message && (
        <p role="status" className="text-sm">
          {result.message}
        </p>
      )}
    </>
  );
}

type TeamOption = { id: string; name: string };

// --- Fixtures --------------------------------------------------------------------
export function FixtureEditor(props: {
  matchId: string;
  seasonId: string;
  date: string;
  time: string;
  matchday: number | null;
}) {
  const [date, setDate] = useState(props.date);
  const [time, setTime] = useState(props.time);
  const [md, setMd] = useState(String(props.matchday ?? ""));
  const { pending, result, run } = useAct();
  return (
    <div className="mt-2 grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Kick-off (WAT, blank = TBC)
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={input}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Matchday
          <input
            type="number"
            min={1}
            value={md}
            onChange={(e) => setMd(e.target.value)}
            className={`${input} w-24`}
          />
        </label>
        <Button
          disabled={pending}
          onClick={() =>
            run(() =>
              updateFixture({
                matchId: props.matchId,
                seasonId: props.seasonId,
                date,
                time,
                matchday: Number(md),
              }),
            )
          }
        >
          Save
        </Button>
      </div>
      <Message result={result} />
    </div>
  );
}

export function AddFixtureForm({ seasonId, teams }: { seasonId: string; teams: TeamOption[] }) {
  const [v, setV] = useState({ homeId: "", awayId: "", date: "", time: "", matchday: "" });
  const { pending, result, run } = useAct();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["homeId", "awayId"] as const).map((k) => (
          <label key={k} className="grid gap-1 text-sm">
            {k === "homeId" ? "Home team" : "Away team"}
            <select value={v[k]} onChange={set(k)} className={input}>
              <option value="">Choose…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Date
          <input type="date" value={v.date} onChange={set("date")} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          Kick-off (WAT, blank = TBC)
          <input type="time" value={v.time} onChange={set("time")} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          Matchday
          <input
            type="number"
            min={1}
            value={v.matchday}
            onChange={set("matchday")}
            className={`${input} w-24`}
          />
        </label>
        <Button
          disabled={pending}
          onClick={() => run(() => addFixture({ seasonId, ...v, matchday: Number(v.matchday) }))}
        >
          Add fixture
        </Button>
      </div>
      <Message result={result} />
    </div>
  );
}

export function CsvImport({ seasonId }: { seasonId: string }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; fileErrors: string[] } | null>(null);
  const { pending, result, run } = useAct();
  const [checking, startCheck] = useTransition();
  const errors = preview
    ? preview.fileErrors.length + preview.rows.filter((r) => r.errors.length).length
    : 0;
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        CSV file (columns: date, time, home, away, matchday)
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setCsv(await f.text());
              setPreview(null);
            }
          }}
          className="text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        …or paste it
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          rows={5}
          className="rounded-lg border bg-background p-3 font-mono text-xs"
          placeholder={"date,time,home,away,matchday\n2027-08-28,16:00,Enyimba,Kano Pillars,1"}
        />
      </label>
      <Button
        variant="secondary"
        disabled={!csv || checking}
        onClick={() => startCheck(async () => setPreview(await previewImport(seasonId, csv)))}
        className="justify-self-start"
      >
        {checking ? "Checking…" : "Check the file"}
      </Button>
      {preview && (
        <div className="grid gap-2">
          {preview.fileErrors.map((e) => (
            <p key={e} role="alert" className="text-sm text-danger">
              {e}
            </p>
          ))}
          {preview.rows.length > 0 && (
            <p className="text-sm">
              {preview.rows.length} rows ·{" "}
              {errors ? <span className="text-danger">{errors} with errors</span> : "no errors"} ·{" "}
              {preview.rows.filter((r) => r.existing).length} already in the season (will be
              skipped)
            </p>
          )}
          <div className="max-h-96 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className="p-2 text-left">Line</th>
                  <th className="p-2 text-left">Match</th>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">MD</th>
                  <th className="p-2 text-left">Check</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t align-top">
                    <td className="p-2">{r.line}</td>
                    <td className="p-2">
                      {r.home} v {r.away}
                    </td>
                    <td className="p-2">
                      {r.date} {r.time || "TBC"}
                    </td>
                    <td className="p-2">{r.matchday}</td>
                    <td className="p-2">
                      {r.errors.length ? (
                        <span className="text-danger">{r.errors.join(" ")}</span>
                      ) : r.existing ? (
                        "Already in the season"
                      ) : (
                        "OK"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={pending || errors > 0}
            onClick={() => run(() => saveImport(seasonId, csv))}
            className="justify-self-start"
          >
            Save fixtures
          </Button>
        </div>
      )}
      <Message result={result} />
    </div>
  );
}

// --- Seasons and teams ---------------------------------------------------------
export function SeasonForm() {
  const [v, setV] = useState({ label: "", start: "", end: "", note: "" });
  const { pending, result, run } = useAct();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Season
          <input
            value={v.label}
            onChange={set("label")}
            placeholder="2027/28"
            className={`${input} w-28`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Starts
          <input type="date" value={v.start} onChange={set("start")} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          Ends
          <input type="date" value={v.end} onChange={set("end")} className={input} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Format note (optional)
        <input value={v.note} onChange={set("note")} className={input} />
      </label>
      <Button
        disabled={pending}
        onClick={() => run(() => createSeason(v))}
        className="justify-self-start"
      >
        Create season
      </Button>
      <Message result={result} />
    </div>
  );
}

export function MakeCurrentButton({ seasonId }: { seasonId: string }) {
  const { pending, result, run } = useAct();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => run(() => setCurrentSeason(seasonId))}
      >
        Make current
      </Button>
      <Message result={result} />
    </span>
  );
}

type Status = "stayed" | "promoted" | "relegated";
export function SeasonTeamsEditor({
  seasonId,
  teams,
  current,
}: {
  seasonId: string;
  teams: TeamOption[];
  current: Record<string, Status>;
}) {
  const [sel, setSel] = useState<Record<string, Status | "">>(
    Object.fromEntries(teams.map((t) => [t.id, current[t.id] ?? ""])),
  );
  const { pending, result, run } = useAct();
  const chosen = Object.entries(sel).filter(([, s]) => s);
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1 sm:grid-cols-2">
        {teams.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-1"
          >
            <span className="text-sm">{t.name}</span>
            <select
              aria-label={`${t.name} this season`}
              value={sel[t.id]}
              onChange={(e) => setSel({ ...sel, [t.id]: e.target.value as Status | "" })}
              className={`${input} h-9 text-sm`}
            >
              <option value="">Not in the league</option>
              <option value="stayed">In the league</option>
              <option value="promoted">Promoted (new)</option>
              <option value="relegated">Relegated at the end</option>
            </select>
          </li>
        ))}
      </ul>
      <Button
        disabled={pending}
        className="justify-self-start"
        onClick={() =>
          run(() =>
            saveSeasonTeams(
              seasonId,
              chosen.map(([teamId, status]) => ({ teamId, status: status as Status })),
            ),
          )
        }
      >
        Save teams ({chosen.length})
      </Button>
      <Message result={result} />
    </div>
  );
}

export function TeamEditor(props: {
  teamId: string;
  code: string;
  city: string;
  primary: string;
  secondary: string;
  crestUrl: string | null;
  aliases: { id: string; alias: string }[];
}) {
  const [v, setV] = useState({
    code: props.code,
    city: props.city,
    primary: props.primary,
    secondary: props.secondary,
  });
  const [alias, setAlias] = useState("");
  const { pending, result, run } = useAct();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  const [crest, setCrest] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [suggested, setSuggested] = useState(false);

  /** Read the chosen crest in the browser and suggest its colours. */
  const chooseCrest = (file: File | null) => {
    setCrest(file);
    setSuggested(false);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.drawImage(img, 0, 0, 64, 64);
      const c = suggestColours(g.getImageData(0, 0, 64, 64).data);
      setV((cur) => ({ ...cur, primary: c.primary, secondary: c.secondary }));
      setSuggested(true);
    };
    img.src = url;
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">
          Crest (shown on the site only, never on share images). PNG, WebP or JPEG, up to 512 KB.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {(preview ?? props.crestUrl) && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded file
            <img
              src={preview ?? props.crestUrl!}
              alt=""
              className="size-14 rounded bg-white/5 object-contain"
            />
          )}
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            aria-label={`Crest image for ${props.code}`}
            onChange={(e) => chooseCrest(e.target.files?.[0] ?? null)}
            className="max-w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:text-foreground"
          />
          <Button
            variant="secondary"
            disabled={pending || !crest}
            onClick={() =>
              run(async () => {
                const f = new FormData();
                f.set("teamId", props.teamId);
                f.set("crest", crest!);
                return uploadCrest(f);
              })
            }
          >
            Upload crest
          </Button>
          {props.crestUrl && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => removeCrest(props.teamId))}
            >
              Remove crest
            </Button>
          )}
        </div>
        {suggested && (
          <p className="text-xs">
            Colours below are suggested from the crest. Check them against the kit, then press Save.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs">
          Code
          <input
            value={v.code}
            onChange={set("code")}
            maxLength={3}
            className={`${input} w-20 uppercase`}
          />
        </label>
        <label className="grid gap-1 text-xs">
          City
          <input value={v.city} onChange={set("city")} className={input} />
        </label>
        <label className="grid gap-1 text-xs">
          Main colour
          <input
            type="color"
            value={v.primary}
            onChange={set("primary")}
            className="h-11 w-16 rounded-lg border bg-background"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Text colour
          <input
            type="color"
            value={v.secondary}
            onChange={set("secondary")}
            className="h-11 w-16 rounded-lg border bg-background"
          />
        </label>
        <span
          aria-hidden="true"
          className="figure inline-flex size-11 items-center justify-center rounded-full text-xs"
          style={{ background: v.primary, color: v.secondary }}
        >
          {v.code}
        </span>
        <Button
          disabled={pending}
          onClick={() => run(() => updateTeam({ teamId: props.teamId, ...v }))}
        >
          Save
        </Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Aliases (names used in fixture lists)</p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {props.aliases.map((a) => (
            <li
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full bg-background py-1 pr-1 pl-3 text-xs"
            >
              {a.alias}
              <button
                type="button"
                aria-label={`Remove ${a.alias}`}
                disabled={pending}
                onClick={() => run(() => deleteAlias(a.id))}
                className="inline-flex size-7 items-center justify-center rounded-full hover:bg-muted"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="New alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. enyimba international"
            className={`${input} flex-1`}
          />
          <Button
            variant="secondary"
            disabled={pending || !alias}
            onClick={() =>
              run(async () => {
                const r = await addAlias(props.teamId, alias);
                if (!r.error) setAlias("");
                return r;
              })
            }
          >
            Add alias
          </Button>
        </div>
      </div>
      <Message result={result} />
    </div>
  );
}

export function DeductionForm({ seasonId, teams }: { seasonId: string; teams: TeamOption[] }) {
  const [v, setV] = useState({ teamId: "", points: "", reason: "" });
  const { pending, result, run } = useAct();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Team
          <select value={v.teamId} onChange={set("teamId")} className={input}>
            <option value="">Choose…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Points
          <input
            type="number"
            min={1}
            value={v.points}
            onChange={set("points")}
            className={`${input} w-24`}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Reason (shown under the table)
        <input value={v.reason} onChange={set("reason")} className={input} />
      </label>
      <Button
        disabled={pending}
        className="justify-self-start"
        onClick={() =>
          run(() =>
            addDeduction({
              seasonId,
              teamId: v.teamId,
              points: Number(v.points),
              reason: v.reason,
            }),
          )
        }
      >
        Record deduction
      </Button>
      <Message result={result} />
    </div>
  );
}

export function RemoveDeductionButton({ id }: { id: string }) {
  const { pending, result, run } = useAct();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => deleteDeduction(id))}
      >
        Remove
      </Button>
      <Message result={result} />
    </span>
  );
}

// --- Model and users -------------------------------------------------------------
export function RunNowButton() {
  const { pending, result, run } = useAct();
  return (
    <div className="grid gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await runModelNow();
            if (r.runId) trackRun({ runId: r.runId, label: "Run now" });
            return r;
          })
        }
        className="justify-self-start"
      >
        Run now
      </Button>
      <Message result={result} />
    </div>
  );
}

export function BanButton({ userId, banned }: { userId: string; banned: boolean }) {
  const { pending, result, run } = useAct();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant={banned ? "secondary" : "destructive"}
        disabled={pending}
        onClick={() => run(() => setBanned(userId, !banned))}
      >
        {banned ? "Unban" : "Ban"}
      </Button>
      <Message result={result} />
    </span>
  );
}

export function SendTestButton() {
  const { pending, result, run } = useAct();
  return (
    <div className="grid gap-2">
      <Button
        disabled={pending}
        onClick={() => run(sendTestPreview)}
        className="justify-self-start"
      >
        {pending ? "Sending…" : "Send a test to me"}
      </Button>
      <Message result={result} />
    </div>
  );
}

// --- Site settings -------------------------------------------------------------
/** The site-wide crest switch. Off hides every crest at once (a quick takedown). */
export function ShowCrestsSwitch({ show }: { show: boolean }) {
  const { pending, result, run } = useAct();
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Crests are <strong>{show ? "showing" : "hidden"}</strong> across the site.
      </p>
      <div>
        <Button
          variant={show ? "secondary" : "default"}
          disabled={pending}
          onClick={() => run(() => setShowCrests(!show))}
        >
          {show ? "Hide all crests" : "Show crests"}
        </Button>
      </div>
      <Message result={result} />
    </div>
  );
}

/** Choose this week's Match of the Week, or go back to the automatic pick. */
export function MotwChooser({
  matches,
  chosen,
}: {
  matches: { id: string; label: string }[];
  chosen: string | null;
}) {
  const [id, setId] = useState(chosen ?? "");
  const { pending, result, run } = useAct();
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-xs">
        Match
        <select value={id} onChange={(e) => setId(e.target.value)} className={input}>
          <option value="">Automatic pick</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Button disabled={pending} onClick={() => run(() => setMotwOverride(id || null))}>
          Save
        </Button>
      </div>
      <Message result={result} />
    </div>
  );
}
