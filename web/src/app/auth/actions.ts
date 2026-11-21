"use server";

import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth/user";
import { publicEnv } from "@/lib/env";
import { parsePendingPick, savePickAs } from "@/lib/picks";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

function callbackUrl(next: string, pick: string | null) {
  const u = new URL("/auth/callback", publicEnv.siteUrl);
  u.searchParams.set("next", next);
  if (pick) u.searchParams.set("pick", pick);
  return u.toString();
}

async function finishLogin(next: string, pick: string | null): Promise<never> {
  const pending = parsePendingPick(pick);
  if (pending) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await savePickAs(supabase, user.id, pending); // a closed window just means no pick
  }
  redirect(next);
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const pick = (form.get("pick") as string | null) || null;
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don't match an account." };
  return finishLogin(next, pick);
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const displayName = String(form.get("display_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const emailOptIn = form.get("email_opt_in") === "on";
  const next = safeNext(form.get("next"));
  const pick = (form.get("pick") as string | null) || null;
  if (displayName.length < 2 || displayName.length > 30)
    return { error: "Choose a display name of 2 to 30 characters." };
  if (!email) return { error: "Enter your email." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, email_opt_in: emailOptIn },
      emailRedirectTo: callbackUrl(next, pick),
    },
  });
  if (error) {
    return {
      error: /registered|exists/i.test(error.message)
        ? "There is already an account with that email. Log in instead."
        : "We couldn't create your account. Please try again.",
    };
  }
  if (!data.session) {
    return {
      message: `Check ${email} for a link to confirm your account. Your pick is saved when you confirm.`,
    };
  }
  return finishLogin(next, pick);
}

export async function logInWithGoogle(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  const pick = (form.get("pick") as string | null) || null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next, pick) },
  });
  if (error || !data.url) redirect(`/login?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/update-password", null),
  });
  // Same answer whether or not the account exists.
  return {
    message: `If there is an account for ${email}, we've sent a link to reset the password.`,
  };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Your reset link has expired. Ask for a new one." };
  redirect("/me");
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
