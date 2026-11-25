import { BRAND, INSTAGRAM_URL, SITE_NAME, SUBSTACK_URL, X_URL } from "@/config/site";
import { publicEnv } from "@/lib/env";

/**
 * /llms.txt: a plain summary of the site for AI answer engines (the
 * llmstxt.org convention), with links to the pages worth reading.
 */
export function GET() {
  const u = publicEnv.siteUrl;
  const body = `# ${SITE_NAME}

> ${SITE_NAME} is a free site from ${BRAND} with predictions for every Nigeria Premier Football League (NPFL) match: the chance of a home win, a draw and an away win, and the most likely scores, from a model called the Ballboy. Fans play Beat the Ballboy, a free prediction game.

Percentages update after every NPFL result. Results, fixtures and the table are checked against published reports.

## Pages

- [Home](${u}/): this matchday's NPFL predictions, Match of the Week and the top of the table
- [Fixtures and results](${u}/fixtures): every NPFL match this season, by matchday, with predictions
- [NPFL table](${u}/table): the current table, with point deductions, and every season since 2021/22
- [Teams](${u}/teams): every NPFL club since 2021/22, with form, results and records
- [Head-to-head](${u}/h2h): every league meeting between two clubs since 2021/22
- [Leaderboard](${u}/leaderboard): Beat the Ballboy standings
- [How it works](${u}/about): what the site is, how the game is scored, questions and answers

## Elsewhere

- [Weekly articles on Substack](${SUBSTACK_URL})
- [X](${X_URL})
- [Instagram](${INSTAGRAM_URL})
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
