import { unsubscribe, verifyUnsubscribe } from "@/lib/email/unsubscribe";

/** One-click unsubscribe from mail apps (RFC 8058): POST with the signed link. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!verifyUnsubscribe(u, t)) return Response.json({ error: "Invalid link" }, { status: 400 });
  await unsubscribe(u);
  return Response.json({ unsubscribed: true });
}
