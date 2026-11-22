"use client";

import { useState, useTransition } from "react";

import { type ResultInput, saveResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { trackRun } from "@/lib/admin/run-store";

export type EditableMatch = {
  id: string;
  home: string;
  away: string;
  when: string;
  status: ResultInput["status"] | "scheduled";
  homeGoals: number | null;
  awayGoals: number | null;
  notes: string | null;
};

const STATUSES: { value: ResultInput["status"]; label: string }[] = [
  { value: "played", label: "Played" },
  { value: "postponed", label: "Postponed" },
  { value: "abandoned", label: "Abandoned" },
  { value: "awarded", label: "Awarded" },
];

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={`${label}: one fewer`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </Button>
      <span className="figure w-10 text-center text-3xl" aria-label={`${label} goals`}>
        {value}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={`${label}: one more`}
        onClick={() => onChange(Math.min(99, value + 1))}
      >
        +
      </Button>
    </div>
  );
}

/** Enter or correct one result: score steppers, status, confirmation, then the run status. */
export function ResultEditor({ match }: { match: EditableMatch }) {
  const [status, setStatus] = useState<ResultInput["status"]>(
    match.status === "scheduled" ? "played" : (match.status as ResultInput["status"]),
  );
  const [h, setH] = useState(match.homeGoals ?? 0);
  const [a, setA] = useState(match.awayGoals ?? 0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState(match.notes ?? "");
  const [step, setStep] = useState<"edit" | "confirm" | "sure">("edit");
  const [result, setResult] = useState<{ error?: string; message?: string; runId?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const scored = status === "played" || status === "awarded";

  const summary =
    status === "postponed"
      ? `Postponed to ${date || "?"} at ${time || "?"} (WAT). Picks carry over.`
      : status === "abandoned"
        ? "Abandoned. Picks on this match are void."
        : `${match.home} ${h}–${a} ${match.away}${status === "awarded" ? " (awarded, left out of the model)" : ""}`;

  function save() {
    setResult(null);
    start(async () => {
      const r = await saveResult({
        matchId: match.id,
        status,
        homeGoals: scored ? h : null,
        awayGoals: scored ? a : null,
        newDate: date,
        newTime: time,
        notes,
      });
      setResult(r);
      setStep("edit");
      if (r.runId) trackRun({ runId: r.runId, label: `${match.home} v ${match.away}: ${summary}` });
    });
  }

  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-xs text-muted-foreground">{match.when}</p>
      <p className="font-medium">
        {match.home} v {match.away}
      </p>

      <fieldset className="mt-3" disabled={pending || step !== "edit"}>
        <legend className="sr-only">Status</legend>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <label
              key={s.value}
              className={`inline-flex h-11 cursor-pointer items-center rounded-lg px-3 text-sm ${status === s.value ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              <input
                type="radio"
                name={`status-${match.id}`}
                value={s.value}
                checked={status === s.value}
                onChange={() => setStatus(s.value)}
                className="sr-only"
              />
              {s.label}
            </label>
          ))}
        </div>
        {scored && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{match.home}</span>
              <Stepper label={match.home} value={h} onChange={setH} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{match.away}</span>
              <Stepper label={match.away} value={a} onChange={setA} />
            </div>
          </div>
        )}
        {status === "postponed" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="grid gap-1 text-sm">
              New date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-lg border bg-background px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Kick-off (WAT)
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 rounded-lg border bg-background px-3"
              />
            </label>
          </div>
        )}
        <label className="mt-3 grid gap-1 text-sm">
          Note (optional, shown on the match page)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            className="h-11 rounded-lg border bg-background px-3"
          />
        </label>
      </fieldset>

      {step === "edit" && (
        <Button className="mt-3" disabled={pending} onClick={() => setStep("confirm")}>
          Save
        </Button>
      )}
      {step === "confirm" && (
        <div className="mt-3 rounded-lg border border-primary/50 p-3">
          <p className="text-sm">Save this?</p>
          <p className="mt-1 font-medium">{summary}</p>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={pending}
              onClick={() => (scored && Math.max(h, a) > 6 ? setStep("sure") : save())}
            >
              Confirm
            </Button>
            <Button variant="secondary" onClick={() => setStep("edit")}>
              Back
            </Button>
          </div>
        </div>
      )}
      {step === "sure" && (
        <div className="mt-3 rounded-lg border border-danger p-3">
          <p className="font-medium">Are you sure? A team scored more than 6.</p>
          <div className="mt-3 flex gap-2">
            <Button disabled={pending} onClick={save}>
              Yes, save {h}–{a}
            </Button>
            <Button variant="secondary" onClick={() => setStep("edit")}>
              Back
            </Button>
          </div>
        </div>
      )}
      {pending && <p className="mt-2 text-sm text-muted-foreground">Saving…</p>}
      {result?.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {result.error}
        </p>
      )}
      {result?.message && (
        <p role="status" className="mt-2 text-sm">
          {result.message}
        </p>
      )}
    </div>
  );
}
