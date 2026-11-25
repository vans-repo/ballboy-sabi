# SEO and AEO guide

How Ballboy Sabi and That Naija Ballboy write so that Google finds the work and
AI answer engines quote it. AI answer engines are Google's AI Overviews,
ChatGPT search, Perplexity and Copilot. This guide applies to site copy, the
weekly Substack articles, X, Instagram and Facebook posts, and the share text.

The house rules still come first: plain English, short sentences, percentages
only, no betting words ("bet", "stake", "odds", "tip", "banker", "slip"), and
no invented facts. Say "free" or "free to play" where it helps. Keep "No
money involved, ever." for where it reassures: sign-up, log-in and the About
page. Repeated on every post, it reads as preachy.

## What people search for

Use the words fans type, early in titles and first sentences.

| They search | Use |
| --- | --- |
| "NPFL table", "NPFL standings" | NPFL table |
| "Rangers vs Enyimba prediction" | `<Home> vs <Away> prediction` |
| "NPFL results", "NPFL matchday 15 results" | NPFL Matchday N results |
| "NPFL fixtures this weekend" | NPFL Matchday N fixtures |
| "Enyimba fixtures", "Enyimba news" | the club's full name, then the nickname once |
| "who is top of the NPFL" | a sentence that answers it with the club, points and games played |

- Write "NPFL" and "Nigeria Premier Football League" in full once per article.
- Write club names in full ("Enugu Rangers", "Kano Pillars"). After that, the
  short name or nickname is fine.
- Use "vs" in titles: people search with it. "v" is fine in body text.

## Every article (Substack)

1. **Title (under 60 characters), keyword first.** For example: "NPFL Matchday 14
   review: Rangers stay top, Bendel slide".
2. **Subtitle (under 155 characters).** It is the search snippet, so it is one
   plain sentence that answers the headline.
3. **Slug.** Short and with keywords, for example `npfl-matchday-14-review`.
   Set it in Substack before you publish.
4. **The answer first.** The first paragraph says what happened, with numbers:
   "Enugu Rangers top the NPFL on 28 points from 13 games after beating Shooting
   Stars 2–0." Answer engines quote opening sentences.
5. **Question headings.** Use two or three section headings phrased as fans
   ask them ("Who is top of the NPFL after Matchday 14?", "Can Enyimba avoid
   relegation?"). Answer each in the first one or two sentences below it.
6. **Tables for results and the table.** Search engines and AI read tables well.
7. **Links.** Link to the site's page for each match, team and the table
   (`https://ballboy-sabi.vercel.app/match/...`, `/team/<slug>`, `/table`).
   Link sources inline. Two or three site links per article is enough.
8. **Dates and facts.** Give the matchday, the date and the season (2026/27).
   Undated claims get skipped by answer engines.
9. **Images.** Give every image alt text that says what is in it, in plain words.
10. **Byline and about line.** End with one line about That Naija Ballboy, with
    the X and Instagram handles. Answer engines weigh who wrote a piece.

## Every post (X, Facebook, Instagram, WhatsApp)

- Put the key fact first, in the opening 100 characters, with numbers.
- Use the full club names once.
- Add `#NPFL`, plus at most one club or event tag (`#AbiaDerby`). More tags read as spam.
- Link the site page the post is about. The site's Share button adds the link, the sign-off and `#NPFL` by itself.
- On X, keep the whole post to 280 characters, counting the link as 23.
- On Instagram, the caption's first line is the hook and the link goes in the
  bio. Add alt text to the image.

## Site copy

- **Page titles.** Each page's title is unique, keyword first, under 60
  characters. The site adds "· Ballboy Sabi".
- **Descriptions.** Each page's description is one plain sentence of 155
  characters or fewer that answers the page's question. For example, a match
  page gives the Ballboy's percentages.
- **Headings.** Each page has one `<h1>` that names what the page is.
- **Canonical links and structured data are automatic.**
  - Pages use `web/src/lib/seo.tsx`.
  - Every page carries the site's WebSite and Organization data.
  - Match pages carry SportsEvent data.
  - Team pages carry SportsTeam data.
  - The About page carries FAQPage data.
  - `/llms.txt` summarises the site for AI tools.
- **New pages.** Give a new public page a title, a description, a canonical
  link and an entry in `web/src/app/sitemap.ts`. Add it to `/llms.txt` if fans
  would ask about it.
- **Fan-facing text never shows the model's workings** (the owner's X posts
  may hint at them).

## Checklist before publishing

- [ ] Keyword-first title under 60 characters, and a subtitle or description under 155
- [ ] The first sentence answers the headline, with a number and a date
- [ ] Club names in full once; "NPFL" and the season named
- [ ] Links to the site's pages and to sources
- [ ] Alt text on images
- [ ] `#NPFL` on posts; no betting words anywhere
