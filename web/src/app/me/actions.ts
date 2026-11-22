"use server";

import { revalidateTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; message?: string } | undefined;

/** Change the signed-in fan's display name and email setting (RLS: own row only). */
export async function saveSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const displayName = String(form.get("display_name") ?? "").trim();
  const emailOptIn = form.get("email_opt_in") === "on";
  if (displayName.length < 2 || displayName.length > 30)
    return { error: "Choose a display name of 2 to 30 characters." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in again to change your settings." };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, email_opt_in: emailOptIn })
    .eq("id", user.id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That display name is taken. Try another."
          : "We couldn't save your settings.",
    };
  }
  revalidateTag(CACHE_TAGS.picks, "max"); // leaderboards show the new name
  return { message: "Saved." };
}
