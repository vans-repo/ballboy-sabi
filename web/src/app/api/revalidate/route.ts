import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { MODEL_RUN_TAGS } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env.server";

/**
 * Called by the model workflow when a run finishes. Marks predictions and
 * team ratings stale so the next request to any page shows the new run.
 * Auth: `Authorization: Bearer <REVALIDATE_SECRET>`.
 */
export async function POST(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${serverEnv.revalidateSecret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  for (const tag of MODEL_RUN_TAGS) {
    revalidateTag(tag, { expire: 0 });
  }
  return Response.json({ revalidated: MODEL_RUN_TAGS });
}
