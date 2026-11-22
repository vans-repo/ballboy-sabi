"use server";

import { type PickInput, savePickAs } from "@/lib/picks";
import { createClient } from "@/lib/supabase/server";

/** Save the signed-in fan's pick. Returns an error message, or null when saved. */
export async function savePick(input: PickInput): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Log in to make picks.";
  return savePickAs(supabase, user.id, input);
}
