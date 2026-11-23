import { connection } from "next/server";

import { CARD_SIZE, motwCard } from "@/lib/motw-image";
import { currentMotw, motwForKey } from "@/lib/motw";

export const alt = "Match of the Week";
export const size = CARD_SIZE;
export const contentType = "image/png";

/** The link card X shows under a "Post on X" post (1200×630). */
export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  await connection();
  const { key } = await params;
  const now = Date.now();
  return motwCard((await motwForKey(key, now)) ?? (await currentMotw(now)));
}
