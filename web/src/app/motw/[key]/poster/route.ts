import { connection } from "next/server";

import { motwPoster } from "@/lib/motw-image";
import { motwForKey } from "@/lib/motw";

/** The portrait poster (1080×1350) behind "Save image". */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  await connection();
  const { key } = await params;
  const w = await motwForKey(key, Date.now());
  if (!w) return new Response("Not found", { status: 404 });
  return motwPoster(w, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Content-Disposition": `inline; filename="ballboy-sabi-${w.key}.png"`,
    },
  });
}
