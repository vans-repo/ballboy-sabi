import { type NextRequest, NextResponse } from "next/server";

import { safeNext } from "@/lib/auth/user";
import { parsePendingPick, savePickAs } from "@/lib/picks";
import { createClient } from "@/lib/supabase/server";

/**
 * Where confirmation, password-reset and Google sign-in links land. Swaps
 * the one-time code for a session, saves a guest's pending pick, then sends
 * the fan on to where they were.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  }
  const pending = parsePendingPick(url.searchParams.get("pick"));
  if (pending) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await savePickAs(supabase, user.id, pending);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
