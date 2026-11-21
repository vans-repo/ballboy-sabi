import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

/**
 * Anonymous Supabase client with no cookies, for public data (fixtures,
 * predictions, the table). Reads exactly what a logged-out visitor may see,
 * so its results are safe to cache and share between requests.
 */
export function createPublicClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
