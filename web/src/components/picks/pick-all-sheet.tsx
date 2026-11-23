"use client";

import Link from "next/link";
import { useState } from "react";

import { PickButtons, type PickTarget } from "@/components/picks/pick-buttons";
import { Button } from "@/components/ui/button";
import { usePicks } from "@/lib/picks-store";

export type SheetItem = PickTarget & {
  home: { name: string; code: string; bg: string; fg: string; crest: string | null };
  away: { name: string; code: string; bg: string; fg: string; crest: string | null };
  when: string;
  pcts: [number, number, number];
};

function Badge({ t }: { t: SheetItem["home"] }) {
  if (t.crest)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small public crest image
      <img src={t.crest} alt="" aria-hidden="true" className="size-12 object-contain" />
    );
  return (
    <span
      aria-hidden="true"
      className="figure inline-flex size-12 items-center justify-center rounded-full text-sm"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {t.code}
    </span>
  );
}

/** Steps through the matchday's open matches one at a time. */
export function PickAllSheet({ items, md }: { items: SheetItem[]; md: number }) {
  const { ready, viewer, picks } = usePicks();
  const [i, setI] = useState(0);
  const done = items.filter((m) => picks[m.matchId]).length;

  if (ready && !viewer) {
    return (
      <div className="rounded-xl bg-surface p-4">
        <p>Log in to make your picks. It&apos;s free, and there&apos;s no money involved.</p>
        <Button asChild className="mt-3">
          <Link href={`/login?next=${encodeURIComponent(`/pick-all?md=${md}`)}`}>Log in</Link>
        </Button>
      </div>
    );
  }
  if (items.length === 0)
    return (
      <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
        No matches are open for picks on this matchday.
      </p>
    );
  if (i >= items.length) {
    return (
      <div className="rounded-xl bg-surface p-4">
        <p className="font-medium">
          {done} of {items.length} picked.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          You can change any pick until its match kicks off.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setI(0)}>
            Review picks
          </Button>
          <Button asChild>
            <Link href={`/fixtures?md=${md}`}>Done</Link>
          </Button>
        </div>
      </div>
    );
  }

  const m = items[i];
  return (
    <div className="rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Match {i + 1} of {items.length}
        </span>
        <span>
          {done}/{items.length} picked
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary"
          style={{ width: `${((i + 1) / items.length) * 100}%` }}
        />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{m.when}</p>
      <div className="mt-3 grid grid-cols-2 gap-4 text-center">
        {[m.home, m.away].map((t) => (
          <div key={t.code} className="flex flex-col items-center gap-2">
            <Badge t={t} />
            <span className="font-medium">{t.name}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm">
        Ballboy: Home <span className="figure">{m.pcts[0]}%</span> · Draw{" "}
        <span className="figure">{m.pcts[1]}%</span> · Away{" "}
        <span className="figure">{m.pcts[2]}%</span>
      </p>
      <div className="mt-4">
        <PickButtons
          key={m.matchId}
          target={{ ...m, labels: { home: m.home.name, away: m.away.name } }}
          size="lg"
          onSaved={() => setTimeout(() => setI((x) => x + 1), 250)}
        />
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          Back
        </Button>
        <Button variant="ghost" onClick={() => setI((x) => x + 1)}>
          {picks[m.matchId] ? "Next" : "Skip"}
        </Button>
      </div>
    </div>
  );
}
