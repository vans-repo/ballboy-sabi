/**
 * Whether a cookie is a Supabase session cookie (`sb-<ref>-auth-token`, or one
 * of its chunks `.0`, `.1`...). Sign-in with Google also leaves short-lived
 * `...-auth-token-code-verifier` cookies; those are not a session, and
 * counting them made the site think a half-finished sign-in was logged in.
 */
export const isSessionCookie = (name: string) =>
  /^sb-[^.]+-auth-token(\.\d+)?$/.test(name) && !name.includes("code-verifier");
