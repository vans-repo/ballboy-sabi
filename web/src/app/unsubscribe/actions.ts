"use server";

import { unsubscribe, verifyUnsubscribe } from "@/lib/email/unsubscribe";

export async function confirmUnsubscribe(
  _: unknown,
  form: FormData,
): Promise<{ done?: boolean; error?: string }> {
  const u = String(form.get("u") ?? "");
  const t = String(form.get("t") ?? "");
  if (!verifyUnsubscribe(u, t))
    return { error: "This link isn't valid. Use the link from your latest email." };
  await unsubscribe(u);
  return { done: true };
}
