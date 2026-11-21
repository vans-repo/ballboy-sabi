import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { CACHE_TAGS, MODEL_RUN_TAGS } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env.server";

/**
 * Called by the model workflow when a run finishes. Marks predictions and
 * team ratings stale so the next request to any page shows the new run.
 * An optional JSON body `{"tags": [...]}` names other known tags instead
 * (for example "matches" after fixtures are loaded).
 * Auth: `Authorization: Bearer <REVALIDATE_SECRET>`.
 */
export async function POST(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${serverEnv.revalidateSecret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const known: string[] = Object.values(CACHE_TAGS);
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const asked = Array.isArray(body?.tags)
    ? body.tags.filter((t): t is string => known.includes(t as string))
    : [];
  const tags = asked.length ? asked : [...MODEL_RUN_TAGS];
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
  return Response.json({ revalidated: tags });
}
