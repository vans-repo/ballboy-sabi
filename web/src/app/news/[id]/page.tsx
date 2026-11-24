import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { NewsImageFrame } from "@/components/news-image";
import { PageTitle } from "@/components/section";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/config/site";
import { formatShortDate } from "@/lib/format";
import { sharedStory } from "@/lib/news-share";

export async function generateMetadata({ params }: PageProps<"/news/[id]">): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const s = await sharedStory(id);
  return s
    ? {
        title: s.h.title,
        description: `${s.label} · ${s.h.source}. Read the full story on ${s.h.source}.`,
      }
    : { title: "NPFL news" };
}

/** A shared NPFL story: the headline, its source and a link to the full story. */
export default function NewsStoryPage({ params }: PageProps<"/news/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <Story params={params} />
    </Suspense>
  );
}

async function Story({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const s = await sharedStory(id);
  if (!s) notFound();
  return (
    <article className="mx-auto max-w-xl">
      {s.image && <NewsImageFrame src={s.image.url} className="mb-5 aspect-[3/2] rounded-2xl" />}
      <p className="text-xs font-bold tracking-wide text-ink uppercase">{s.label}</p>
      <PageTitle sub={`${s.h.source} · ${formatShortDate(s.h.date)}`}>{s.h.title}</PageTitle>
      <Button asChild size="lg">
        <a href={s.h.url} target="_blank" rel="noopener">
          Read the full story on {s.h.source} ↗
        </a>
      </Button>
      <p className="mt-6 text-sm text-muted-foreground">
        Shared by {SITE_NAME}. The story belongs to {s.h.source}.
      </p>
    </article>
  );
}
