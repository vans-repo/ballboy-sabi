import { ALL_CATEGORIES, GENERAL_CATEGORY, NEWS_CATEGORIES } from "@/config/news-categories";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = NEWS_CATEGORIES.map((c) => ({
  key: c.key,
  re: new RegExp(`\\b(${c.words.map(escape).join("|")})\\b`, "i"),
}));

/** The category key for a headline: the first category whose words appear in it, else "general". */
export function categorise(headline: string): string {
  return MATCHERS.find((m) => m.re.test(headline))?.key ?? GENERAL_CATEGORY.key;
}

export const categoryLabel = (key: string) =>
  ALL_CATEGORIES.find((c) => c.key === key)?.label ?? GENERAL_CATEGORY.label;

/**
 * A steady pick from a list: the same story always gets the same image,
 * and different stories spread across the set.
 */
export function pickFor<T>(seed: string, items: T[]): T | undefined {
  if (!items.length) return undefined;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}
