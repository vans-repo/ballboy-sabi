/**
 * Suggest a team's two colours from its crest's pixels (RGBA, as from a
 * canvas). The admin always confirms them: crests often carry white, gold or
 * black trim that isn't the kit colour.
 *
 * Main colour: the most common clearly coloured pixel group (white, black and
 * greys are skipped unless the crest has nothing else). Text colour: the next
 * most common colour that reads on the main one, else white or navy.
 */
export function suggestColours(rgba: Uint8ClampedArray): { primary: string; secondary: string } {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const neutral = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const grey = max - min < 30 || max < 40;
    // Group to 4 bits a channel so anti-aliased edges join their colour.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const map = grey ? neutral : counts;
    const c = map.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++;
    c.r += r;
    c.g += g;
    c.b += b;
    map.set(key, c);
  }
  const ranked = [
    ...(counts.size ? counts : neutral).values(),
    ...(counts.size ? neutral.values() : []),
  ]
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((c) => [c.r / c.n, c.g / c.n, c.b / c.n] as const);
  if (!ranked.length) return { primary: "#64748B", secondary: "#FFFFFF" };

  const primary = ranked[0];
  const second = ranked.find((c) => distance(c, primary) > 90 && contrast(c, primary) >= 3);
  const fallback =
    contrast([255, 255, 255], primary) >= contrast([0, 31, 85], primary)
      ? ([255, 255, 255] as const)
      : ([0, 31, 85] as const);
  return { primary: hex(primary), secondary: hex(second ?? fallback) };
}

type RGB = readonly [number, number, number];

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function luminance([r, g, b]: RGB) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const hex = (c: RGB) =>
  `#${c
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
