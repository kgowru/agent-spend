"use client";

import { useState, type FormEvent } from "react";

/*
 * A small contact form that relays to the maintainer's inbox via /api/feedback.
 * The email field is optional and only used as a reply-to, so leaving it blank
 * still sends — it just can't be answered.
 */

type Status = "idle" | "sending" | "sent" | "error";

const inputClasses =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-muted/70 transition focus:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft";

export function Feedback() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      message: String(data.get("message") ?? ""),
      email: String(data.get("email") ?? ""),
      website: String(data.get("website") ?? ""),
    };

    if (payload.message.trim() === "") {
      setStatus("error");
      setError("Please write a message first.");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }

      form.reset();
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section
      id="feedback"
      aria-labelledby="feedback-heading"
      className="mx-auto w-full max-w-2xl scroll-mt-24 px-6 py-20 sm:py-24"
    >
      <div className="glass rounded-3xl p-8 sm:p-10">
        <h2
          id="feedback-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Send feedback
        </h2>
        <p className="mt-4 text-sm/6 text-muted">
          Found a bug, want a feature, or just have a thought? Send it straight
          to me. Leave your email if you&rsquo;d like a reply.
        </p>

        {status === "sent" ? (
          <p
            role="status"
            className="mt-8 rounded-2xl border border-spark-teal/25 bg-spark-teal/10 px-4 py-3 text-sm text-spark-teal-soft"
          >
            Thanks — your feedback is on its way. I read every note.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="feedback-message" className="sr-only">
                Your feedback
              </label>
              <textarea
                id="feedback-message"
                name="message"
                required
                rows={5}
                maxLength={5000}
                placeholder="What&rsquo;s on your mind?"
                className={`${inputClasses} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="feedback-email" className="sr-only">
                Your email (optional)
              </label>
              <input
                id="feedback-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="Your email (optional, for a reply)"
                className={inputClasses}
              />
            </div>

            {/* Honeypot: hidden from people, tempting to bots. */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor="feedback-website">Leave this field empty</label>
              <input
                id="feedback-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {status === "error" && error ? (
              <p role="alert" className="text-sm text-spark-orange-soft">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-canvas transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
