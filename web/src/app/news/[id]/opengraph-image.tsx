import { connection } from "next/server";

import { NEWS_CARD_SIZE, newsCard } from "@/lib/news-card";
import { sharedStory } from "@/lib/news-share";

export const alt = "NPFL news";
export const size = NEWS_CARD_SIZE;
export const contentType = "image/png";

/** The card X shows under a shared NPFL story. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return newsCard(await sharedStory(id));
}
