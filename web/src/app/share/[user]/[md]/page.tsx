import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card, PageTitle } from "@/components/section";
import { Button } from "@/components/ui/button";
import { FREE_SHORT, SITE_NAME } from "@/config/site";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { ordinal } from "@/lib/format";
import { matchdayCard } from "@/lib/share";

type Params = { user: string; md: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { user, md } = await params;
  const card = await cached(user, md);
  return card
    ? {
        title: `${card.name}'s Matchday ${card.md}`,
        description: `${card.me.points} points on Beat the Ballboy, ${SITE_NAME}'s free NPFL prediction game.`,
        robots: { index: false },
      }
    : { title: "Beat the Ballboy", robots: { index: false } };
}

async function cached(user: string, md: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.picks, CACHE_TAGS.matches);
  return matchdayCard(user, Number(md));
}

export default function SharePage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: Promise<Params> }) {
  const { user, md } = await params;
  const card = await cached(user, md);
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-md">
      <PageTitle sub={`${card.season} · Beat the Ballboy`}>
        {card.name}&apos;s Matchday {card.md}
      </PageTitle>
      <Card className="grid gap-2">
        <p>
          <span className="figure text-6xl text-ink">{card.me.points}</span> points
        </p>
        <p>
          {ordinal(card.me.rank)} of {card.fans + 1} · {card.me.correct} right · {card.me.exact}{" "}
          exact
        </p>
        {card.ballboy && (
          <p className="text-muted-foreground">The Ballboy scored {card.ballboy.points}.</p>
        )}
      </Card>
      <p className="mt-6">
        Think you can beat The Ballboy? Pick NPFL results before kick-off and score more for the
        surprises.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{FREE_SHORT}</p>
      <Button asChild size="lg" className="mt-4">
        <Link href="/pick-all">Play Beat the Ballboy</Link>
      </Button>
    </div>
  );
}
