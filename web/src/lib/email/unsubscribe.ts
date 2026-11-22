import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { publicEnv } from "@/lib/env";

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("Missing environment variable UNSUBSCRIBE_SECRET. See .env.example.");
  return s;
}

/** A signature that proves the link was made for this user. Never expires. */
export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(userId)) return false;
  const want = Buffer.from(unsubscribeToken(userId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** The page fans click (one button, no login). */
export function unsubscribeUrl(userId: string): string {
  const u = new URL("/unsubscribe", publicEnv.siteUrl);
  u.searchParams.set("u", userId);
  u.searchParams.set("t", unsubscribeToken(userId));
  return u.toString();
}

/** For mail apps' own "Unsubscribe" button (RFC 8058 one-click POST). */
export function oneClickUrl(userId: string): string {
  const u = new URL("/api/unsubscribe", publicEnv.siteUrl);
  u.searchParams.set("u", userId);
  u.searchParams.set("t", unsubscribeToken(userId));
  return u.toString();
}

export async function unsubscribe(userId: string): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient()
    .from("profiles")
    .update({ email_opt_in: false })
    .eq("id", userId)
    .select("id");
  return !!data?.length;
}
