import Link from "next/link";

import { CopyBox } from "@/components/admin/copy-box";
import { Card, Empty, PageTitle, Section } from "@/components/section";
import { SUBSTACK_URL, X_URL } from "@/config/site";
import { requireAdmin } from "@/lib/admin/guard";
import { getContext } from "@/lib/data/context";
import { hasResult } from "@/lib/football";
import { buildRecap } from "@/lib/recap";
import { renderTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The week's findings, ready to copy into a Substack draft and X posts. */
export default async function RecapPage({ searchParams }: PageProps<"/admin/recap">) {
  await requireAdmin();
  const { md } = (await searchParams) as { md?: string };
  const now = renderTime();
  const ctx = await getContext();
  const season = ctx.matches.filter((m) => m.seasonId === ctx.current.id);
  const withResults = [
    ...new Set(
      season
        .filter(hasResult)
        .map((m) => m.matchday)
        .filter((d): d is number => d !== null),
    ),
  ].sort((a, b) => b - a);
  const chosen = md ? Number(md) : withResults[0];
  const recap = chosen ? await buildRecap(chosen, now) : null;

  return (
    <>
      <PageTitle sub="The week's numbers, ready to copy into a Substack draft and X posts.">
        Weekly recap
      </PageTitle>
      <nav aria-label="Matchdays" className="mb-4 flex flex-wrap gap-1">
        {withResults.slice(0, 12).map((d) => (
          <Link
            key={d}
            href={`/admin/recap?md=${d}`}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-lg text-sm",
              d === chosen ? "bg-primary text-primary-foreground" : "bg-surface",
            )}
          >
            {d}
          </Link>
        ))}
      </nav>
      {!recap ? (
        <Empty>No matchday with results yet.</Empty>
      ) : (
        <>
          <Section title={`Article notes, Matchday ${recap.md}`}>
            <Card className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Facts from the published data ({recap.played} results). Paste into a{" "}
                <a
                  href={`${SUBSTACK_URL}/publish/post`}
                  target="_blank"
                  rel="noopener"
                  className="text-ink underline underline-offset-2"
                >
                  new Substack post
                </a>{" "}
                and write around them.
              </p>
              <CopyBox text={recap.notes} label="Article notes" rows={12} />
            </Card>
          </Section>
          <Section title="X posts">
            <p className="mb-3 text-sm text-muted-foreground">
              Each fits in one post. Match links show the match&apos;s share image on X. Post from{" "}
              <a
                href={X_URL}
                target="_blank"
                rel="noopener"
                className="text-ink underline underline-offset-2"
              >
                @NaijaBallboy
              </a>
              .
            </p>
            <ul className="grid gap-3">
              {recap.posts.map((p, i) => (
                <li key={i}>
                  <Card>
                    <CopyBox text={p} label={`X post ${i + 1}`} rows={3} />
                  </Card>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
