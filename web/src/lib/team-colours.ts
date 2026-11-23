/**
 * The two team-colour bands on posters and match headers. Each band uses
 * the team's main colour with its code in the team's text colour. When the
 * two main colours are too alike (yellow v yellow, the usual green-and-yellow
 * clash), the away side switches to its second colour, the way an away kit
 * would: band in the text colour, code in the main colour.
 */
type TeamColours = { primary_colour: string; secondary_colour: string };
export type Band = { bg: string; fg: string };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Rough perceptual distance (redmean); under about 120 the bands look the same. */
export function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2,
    dg = g1 - g2,
    db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export const CLASH_DISTANCE = 120;

export function teamBands(home: TeamColours, away: TeamColours): { home: Band; away: Band } {
  const h = { bg: home.primary_colour, fg: home.secondary_colour };
  const clash = colourDistance(home.primary_colour, away.primary_colour) < CLASH_DISTANCE;
  const a = clash
    ? { bg: away.secondary_colour, fg: away.primary_colour }
    : { bg: away.primary_colour, fg: away.secondary_colour };
  return { home: h, away: a };
}
