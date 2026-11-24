import "server-only";

import { getNewsImages, type NewsImage } from "@/lib/data";
import { getLeagueNews, type Headline } from "@/lib/news";
import { categorise, categoryLabel, pickFor } from "@/lib/news-category";

export type SharedStory = { h: Headline; category: string; label: string; image?: NewsImage };

/** The story behind /news/<id>: one of this week's NPFL headlines, with its category image. */
export async function sharedStory(id: string): Promise<SharedStory | null> {
  const [news, images] = await Promise.all([getLeagueNews(), getNewsImages()]);
  const h = news.headlines.find((x) => x.id === id);
  if (!h) return null;
  return { h, ...storyLook(h, images) };
}

/** A headline's category and a steady pick from its images (General if it has none). */
export function storyLook(h: Pick<Headline, "title" | "url">, images: NewsImage[]) {
  const category = categorise(h.title);
  const own = images.filter((i) => i.category === category);
  const pool = own.length ? own : images.filter((i) => i.category === "general");
  return { category, label: categoryLabel(category), image: pickFor(h.url, pool) };
}
