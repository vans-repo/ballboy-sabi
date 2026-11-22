import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  displayName: string;
  role: "fan" | "admin" | "system";
  emailOptIn: boolean;
  banned: boolean;
  createdAt: string;
};

/** The signed-in fan with their profile, or null. Reads cookies: call inside <Suspense>. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("display_name,role,email_opt_in,banned,created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!p) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: p.display_name,
    role: p.role,
    emailOptIn: p.email_opt_in,
    banned: p.banned,
    createdAt: p.created_at,
  };
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : fallback;
}
