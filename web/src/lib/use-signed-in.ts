"use client";

import { useEffect, useState } from "react";

/** The same test the proxy uses: is there a Supabase session cookie? */
const hasSessionCookie = () =>
  document.cookie.split(";").some((c) => {
    const name = c.trim().split("=")[0];
    return name.startsWith("sb-") && name.includes("auth-token");
  });

/**
 * Whether someone is logged in, from the session cookie (no network call).
 * null until checked; checked again on every page change, so logging in or
 * out shows straight away.
 */
/** `path` is the current URL path (or null while unknown): a change re-checks the cookie. */
export function useSignedIn(path: string | null): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    // Reading a browser-only value after mount is the point here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(hasSessionCookie());
  }, [path]);
  return signedIn;
}
