import Link from "next/link";

import { Card, Empty, PageTitle, Section } from "@/components/section";
import { requireAdmin } from "@/lib/admin/guard";
import { getNewsImages } from "@/lib/data";
import { publicEnv } from "@/lib/env";
import { formatShortDate } from "@/lib/format";
import { xIntentUrl } from "@/lib/motw";
import { getLeagueNews } from "@/lib/news";
import { storyLook } from "@/lib/news-share";

/** This week's NPFL headlines, each with a branded card to post on X or save. */
export default async function AdminNewsPage() {
  await requireAdmin();
  const [news, images] = await Promise.all([getLeagueNews(), getNewsImages()]);
  const site = publicEnv.siteUrl;

  return (
    <>
      <PageTitle sub="Post on X shares a link to the story's page on this site; X shows the branded card under your post, and the page links to the full story. Save image downloads the card for Instagram or WhatsApp.">
        News
      </PageTitle>
      {news.headlines.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {news.headlines.map((h) => {
            const look = storyLook(h, images);
            const link = `${site}/news/${h.id}`;
            return (
              <li key={h.id}>
                <Card className="grid gap-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated card */}
                  <img
                    src={`/news/${h.id}/card`}
                    width={1200}
                    height={630}
                    alt=""
                    loading="lazy"
                    className="h-auto w-full rounded-lg"
                  />
                  <p className="text-xs font-bold tracking-wide text-ink uppercase">
                    {look.label}
                    {!look.image && (
                      <span className="ml-2 font-normal text-muted-foreground normal-case">
                        (no image for this category yet: add some in Images)
                      </span>
                    )}
                  </p>
                  <p className="font-medium">{h.title}</p>
                  <p className="text-muted-foreground">
                    {h.source} · {formatShortDate(h.date)} ·{" "}
                    <a href={h.url} target="_blank" rel="noopener" className="underline">
                      Original ↗
                    </a>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={xIntentUrl(`${h.title} (${h.source})`, link)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex h-11 items-center rounded-lg bg-foreground px-4 font-bold text-background hover:opacity-90"
                    >
                      Post on X
                    </a>
                    <a
                      href={`/news/${h.id}/card`}
                      download={`ballboy-sabi-news-${h.id}.png`}
                      className="inline-flex h-11 items-center rounded-lg bg-muted px-4 font-semibold hover:bg-muted/70"
                    >
                      Save image
                    </a>
                    <Link
                      href={`/news/${h.id}`}
                      className="inline-flex h-11 items-center px-2 text-ink underline"
                    >
                      Share page
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Section title="This week">
          <Empty>No NPFL headlines in the news feeds this week.</Empty>
        </Section>
      )}
    </>
  );
}
