/**
 * Nigerian outlets whose public RSS feeds the Home page reads for NPFL
 * headlines. Feeds are published for exactly this (headline, link, date);
 * the site shows the headline and links out, never the article itself.
 * A feed that fails or moves is skipped. /admin → Match of the Week shows
 * how many stories each one gave.
 */
export const NEWS_FEEDS: { name: string; url: string }[] = [
  { name: "Premium Times", url: "https://www.premiumtimesng.com/sports/football/feed" },
  { name: "The Guardian Nigeria", url: "https://guardian.ng/category/sport/football/feed/" },
  { name: "Punch", url: "https://punchng.com/topics/sports/feed/" },
  { name: "Daily Trust", url: "https://dailytrust.com/sports/feed/" },
  { name: "Vanguard", url: "https://www.vanguardngr.com/category/sports/feed/" },
  { name: "Leadership", url: "https://leadership.ng/sports/feed/" },
  { name: "The Nation", url: "https://thenationonlineng.net/sports/feed/" },
  { name: "Complete Sports", url: "https://www.completesports.com/feed/" },
];

/** Words that mark a story as about the league (club names are added from the database). */
export const NEWS_KEYWORDS = [
  "NPFL",
  "Nigeria Premier Football League",
  "Nigeria Professional Football League",
];
