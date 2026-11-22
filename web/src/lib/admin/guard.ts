import "server-only";

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getViewer, type Viewer } from "@/lib/auth/user";

/**
 * The signed-in admin, or a 404 for everyone else (so /admin looks like it
 * doesn't exist). The proxy already answers 404 before the page renders;
 * this is the second check, and RLS is the third.
 */
export async function requireAdmin(): Promise<Viewer> {
  await connection();
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.banned) notFound();
  return viewer;
}
