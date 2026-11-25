import type { Metadata } from "next";

import { Card, PageTitle, Section } from "@/components/section";
import { BRAND, CONTACT_EMAIL, FREE_TO_PLAY_LINE, SITE_NAME } from "@/config/site";
import { JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How It Works: NPFL predictions and Beat the Ballboy",
  description: `${SITE_NAME} gives the chance of a home win, draw and away win for every NPFL match. Beat the Ballboy is a free prediction game: how it works and how points are scored.`,
  alternates: { canonical: "/about" },
};

/** Plain questions and direct answers: shown on the page and given to search and AI answer engines. */
const FAQ = [
  {
    q: `What is ${SITE_NAME}?`,
    a: `${SITE_NAME} is a free site from ${BRAND} with predictions for every Nigeria Premier Football League (NPFL) match: the chance of a home win, a draw and an away win, and the most likely scores. It also has fixtures, results, the league table and team pages.`,
  },
  {
    q: "Where do the NPFL predictions come from?",
    a: "From the Ballboy, a model that reads every NPFL result since the 2021/22 season and updates its chances after each match.",
  },
  {
    q: "How do I play Beat the Ballboy?",
    a: "Pick Home, Draw or Away for each NPFL match before kick-off. You can change a pick until the match kicks off. The Ballboy plays too, under the same rules, and the leaderboard shows who called the results better.",
  },
  {
    q: "How are points scored?",
    a: "A correct pick earns more points the less likely the Ballboy thought it was: 1 divided by the Ballboy's chance of that result, rounded, from 1 to 10. An exact score earns 3 more. A wrong pick, or no pick, earns 0.",
  },
  {
    q: `Is ${SITE_NAME} free?`,
    a: `Yes. ${FREE_TO_PLAY_LINE} There are no prizes and nothing to pay.`,
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-prose">
      <PageTitle>How It Works</PageTitle>

      <Section title={`What ${SITE_NAME} is`}>
        <div className="grid gap-3">
          <p>
            {SITE_NAME} is a free site from {BRAND} with data-driven predictions for every Nigeria
            Premier Football League match. For each game you see the chance of a home win, a draw
            and an away win, and the most likely scores.
          </p>
          <p>
            The numbers come from The Ballboy. It reads every NPFL result and updates its chances
            after each one. Your job: call the results better than it does.
          </p>
        </div>
      </Section>

      <Section title="Beat the Ballboy">
        <div className="grid gap-3">
          <p>
            Pick Home, Draw or Away for each match before kick-off. You can change a pick until that
            match kicks off. The Ballboy plays too, under the same rules.
          </p>
          <Card className="grid gap-2 text-sm">
            <p>
              <span className="font-medium">A correct pick</span> earns more points the less likely
              the Ballboy thought it was: points = 1 ÷ the Ballboy&apos;s chance of that result,
              rounded, from 1 to 10.
            </p>
            <p>
              For example, with 65% / 26% / 12%, a correct Home pick earns 2 points, a correct Draw
              4 and a correct Away 8. So always picking home cannot win.
            </p>
            <p>
              <span className="font-medium">Exact score bonus:</span> +3 when your score is exactly
              right.
            </p>
            <p>A wrong pick, or no pick, earns 0.</p>
            <p>
              The points shown on the buttons follow the latest prediction. They become final at
              kick-off. If a match is postponed, your pick carries over to the new date. If it is
              abandoned or cancelled, picks earn nothing.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Free">
        <p className="font-medium">{FREE_TO_PLAY_LINE}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {SITE_NAME} shows percentages only. There are no prizes and nothing to pay.
        </p>
      </Section>

      <Section title="Questions">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }}
        />
        <dl className="grid gap-4">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-medium">{q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Contact">
        {CONTACT_EMAIL ? (
          <p>
            Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">Contact details are coming soon.</p>
        )}
      </Section>
    </div>
  );
}
