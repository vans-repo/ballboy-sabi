import { connection } from "next/server";

import { newsCard } from "@/lib/news-card";
import { sharedStory } from "@/lib/news-share";

/** The same card as a download ("Save image"). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const s = await sharedStory(id);
  if (!s) return new Response("Not found", { status: 404 });
  return newsCard(s, {
    headers: {
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "Content-Disposition": `inline; filename="ballboy-sabi-news-${id}.png"`,
    },
  });
}
