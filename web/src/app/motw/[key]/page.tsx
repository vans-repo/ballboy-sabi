import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { MotwShareButtons } from "@/components/motw-card";
import { PageTitle } from "@/components/section";
import { Button } from "@/components/ui/button";
import { motwForKey, motwPostText } from "@/lib/motw";
import { renderTime } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/motw/[key]">): Promise<Metadata> {
  await connection();
  const { key } = await params;
  const w = await motwForKey(key, renderTime());
  if (!w) return { title: "Match of the Week" };
  const title =
    w.kind === "match"
      ? `Match of the Week: ${w.home.name} v ${w.away.name}`
      : w.kind === "recap"
        ? `The Ballboy's week: Matchday ${w.md}`
        : "Beat the Ballboy";
  return { title, description: motwPostText(w) };
}

export default function MotwPage({ params }: PageProps<"/motw/[key]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <MotwDetail params={params} />
    </Suspense>
  );
}

async function MotwDetail({ params }: { params: Promise<{ key: string }> }) {
  await connection();
  const { key } = await params;
  const w = await motwForKey(key, renderTime());
  if (!w) notFound();
  return (
    <div className="mx-auto max-w-md">
      <PageTitle sub={motwPostText(w)}>
        {w.kind === "match"
          ? "Match of the Week"
          : w.kind === "recap"
            ? "The Ballboy's week"
            : "Beat the Ballboy"}
      </PageTitle>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, already sized */}
      <img
        src={`/motw/${w.key}/poster`}
        width={1080}
        height={1350}
        alt={motwPostText(w)}
        className="h-auto w-full rounded-2xl"
      />
      <MotwShareButtons w={w} className="mt-4" />
      <div className="mt-4">
        <Button asChild size="lg">
          {w.kind === "match" ? (
            <Link href={`/match/${w.match.id}`}>See the match and make your pick</Link>
          ) : (
            <Link href="/fixtures">See the fixtures</Link>
          )}
        </Button>
      </div>
    </div>
  );
}
