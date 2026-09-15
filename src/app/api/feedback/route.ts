import { Resend } from "resend";

/*
 * Feedback intake. The form posts { message, email?, website? } here and we
 * relay it to the maintainer's inbox via Resend.
 *
 * `website` is a honeypot: a hidden field no human fills in. A filled value is
 * almost certainly a bot, so we accept the request (200, so the bot learns
 * nothing) but drop it.
 *
 * Delivery config is env-driven so the recipient / sender can change without a
 * code edit, but both have sensible defaults so the route works the moment
 * RESEND_API_KEY is present.
 */

const TO_EMAIL = process.env.FEEDBACK_TO_EMAIL ?? "k.gowru@gmail.com";
/* Resend's shared onboarding sender needs no domain verification. Swap this for
 * a verified-domain address once one exists. */
const FROM_EMAIL =
  process.env.FEEDBACK_FROM_EMAIL ?? "AgentSpend <onboarding@resend.dev>";

const MAX_MESSAGE = 5000;
const MAX_EMAIL = 254;

/* Not RFC-complete, just enough to reject an obviously bad reply-to before we
 * hand it to Resend. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet: don't pretend it worked.
    return bad("Feedback is not configured yet. Please try again later.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Expected a JSON body.");
  }

  const { message, email, website } = (body ?? {}) as {
    message?: unknown;
    email?: unknown;
    website?: unknown;
  };

  // Honeypot tripped — accept without sending.
  if (typeof website === "string" && website.trim() !== "") {
    return Response.json({ ok: true });
  }

  if (typeof message !== "string" || message.trim() === "") {
    return bad("A message is required.");
  }
  if (message.length > MAX_MESSAGE) {
    return bad("That message is too long.");
  }

  let replyTo: string | undefined;
  if (email != null && email !== "") {
    if (typeof email !== "string" || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return bad("That email address looks invalid.");
    }
    replyTo = email;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: "AgentSpend feedback",
    replyTo,
    text: [
      replyTo ? `From: ${replyTo}` : "From: (no email given)",
      "",
      message.trim(),
    ].join("\n"),
  });

  if (error) {
    // Log server-side for debugging; keep the client message generic.
    console.error("Resend send failed:", error);
    return bad("Could not send your feedback. Please try again.", 502);
  }

  return Response.json({ ok: true });
}
