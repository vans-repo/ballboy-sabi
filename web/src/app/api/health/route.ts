import { connection } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";

/**
 * Keep-awake: a Vercel Cron job calls this daily, because free Supabase
 * projects pause after a week without activity. One tiny real query.
 */
export async function GET() {
  await connection();
  const { error } = await createPublicClient().from("seasons").select("id").limit(1);
  return error
    ? Response.json({ ok: false, error: error.message }, { status: 503 })
    : Response.json({ ok: true, at: new Date().toISOString() });
}
