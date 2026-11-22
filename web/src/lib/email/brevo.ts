import "server-only";

export type Email = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

/**
 * Send one email through Brevo's transactional API (free plan: 300 a day).
 * Returns null when Brevo accepted it, or the reason it didn't.
 */
export async function sendEmail(email: Email): Promise<string | null> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!key || !from)
    return "Email is not set up: BREVO_API_KEY and EMAIL_FROM_ADDRESS are missing.";
  const api = process.env.BREVO_API_URL || "https://api.brevo.com";
  try {
    const r = await fetch(`${api}/v3/smtp/email`, {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: from, name: process.env.EMAIL_FROM_NAME || "That Naija Ballboy" },
        to: [email.to],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        headers: email.headers,
      }),
    });
    if (r.ok) return null;
    return `Brevo refused the email (HTTP ${r.status}): ${(await r.text()).slice(0, 300)}`;
  } catch (e) {
    return `Couldn't reach Brevo: ${(e as Error).message}`;
  }
}
