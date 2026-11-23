import type { Metadata } from "next";

import { Card, PageTitle, Section } from "@/components/section";
import { BRAND, CONTACT_EMAIL, FREE_TO_PLAY_LINE, SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "How It Works",
  description: `What ${SITE_NAME} is, how Beat the Ballboy scoring works, and how to contact us.`,
};

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
