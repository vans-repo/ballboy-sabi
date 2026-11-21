/**
 * Typed access to environment variables. Every variable is documented in
 * .env.example at the repository root.
 *
 * Only NEXT_PUBLIC_* values may reach the browser. Server-only secrets live
 * in env.server.ts, which cannot be imported from client components.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

// NEXT_PUBLIC_* must be read with literal property access so Next.js can
// inline them into the browser bundle.
export const publicEnv = {
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  },
};
