import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Keeps the Supabase session fresh on pages that read it from cookies, and
 * hides /admin (404) from everyone but admins.
 * Public pages are cached and don't need this; route handlers and server
 * actions refresh the session themselves. Skipped entirely for guests.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminPath =
    path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  // /admin answers 404 to anyone who isn't an admin, as if it didn't exist.
  const notFound = () => NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  if (!hasSession) return isAdminPath ? notFound() : NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isAdminPath) {
    const { data } = user
      ? await supabase.from("profiles").select("role,banned").eq("id", user.id).maybeSingle()
      : { data: null };
    if (!data || data.role !== "admin" || data.banned) return notFound();
  }
  return response;
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/me/:path*",
    "/pick-all/:path*",
    "/leaderboard/:path*",
    "/",
    "/fixtures",
    "/match/:path*",
  ],
};
