import { timingSafeEqual } from "node:crypto";

import { sendEmail } from "@/lib/email/brevo";
import { nextPreview, renderPreview } from "@/lib/email/preview";
import { runPreviewQueue } from "@/lib/email/queue";

/**
 * Daily Vercel Cron job: queues the Matchday Preview when it's due and sends
 * up to EMAIL_DAILY_LIMIT. Auth: `Authorization: Bearer <CRON_SECRET>`, which
 * Vercel Cron sends automatically.
 *
 * `?test=1` instead sends the next preview once to EMAIL_TEST_ADDRESS (a
 * fixed address from the server's settings, never from the request), and
 * records nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (new URL(request.url).searchParams.get("test") === "1") {
    const to = process.env.EMAIL_TEST_ADDRESS;
    if (!to) return Response.json({ error: "Set EMAIL_TEST_ADDRESS first." }, { status: 400 });
    const plan = await nextPreview(Date.now());
    if (!plan) return Response.json({ error: "No upcoming matchday to preview." }, { status: 404 });
    const message = renderPreview(plan, {
      id: "00000000-0000-0000-0000-000000000000",
      name: "test reader",
    });
    const failure = await sendEmail({ to: { email: to }, ...message });
    return failure
      ? Response.json({ error: failure }, { status: 502 })
      : Response.json({ sent: message.subject, to });
  }
  const limit = Number.parseInt(process.env.EMAIL_DAILY_LIMIT ?? "280", 10) || 280;
  try {
    const report = await runPreviewQueue(Date.now(), limit);
    return Response.json(report);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
