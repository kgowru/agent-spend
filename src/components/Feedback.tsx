"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

/*
 * A collapsed "Send feedback" card that expands into a contact form on click.
 * The form relays to the maintainer's inbox via /api/feedback. The email field
 * is optional and only used as a reply-to, so leaving it blank still sends — it
 * just can't be answered.
 *
 * Collapsed and expanded share one DOM tree so the height can animate (the
 * grid-rows 0fr→1fr trick); the body is marked `inert` while collapsed so its
 * inputs stay out of the tab order and off screen readers.
 */

type Status = "idle" | "sending" | "sent" | "error";

/*
 * How long the card takes to open, in step with the duration class on the
 * panel. The focus waits it out: focusing the textarea while the panel is still
 * growing paints its focus ring across a half-clipped box, and asks the browser
 * to scroll to an element that is still moving.
 */
const OPEN_MS = 360;

const inputClasses =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-muted/70 transition focus:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft";

export function Feedback() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Drop focus into the message box once the card has finished opening.
  useEffect(() => {
    if (!expanded) return;

    const id = window.setTimeout(
      // The card is already on screen; the scroll would only fight the
      // animation that just finished.
      () => messageRef.current?.focus({ preventScroll: true }),
      OPEN_MS,
    );
    return () => window.clearTimeout(id);
  }, [expanded]);

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
      className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-20 sm:py-24"
    >
      {/* Squares up with the grids and the FAQ above rather than sitting in a
       * narrower column of its own. */}
      <div className="glass w-full overflow-hidden rounded-3xl">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="feedback-panel"
          /* The hover tint is for the collapsed card, where the button is the
           * whole card. Left on while open it lights the header alone, drawing
           * a hard lit band across the top of the form under the pointer that
           * just opened it. */
          className={`flex w-full items-center justify-between gap-4 p-8 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-spark-teal-soft sm:p-10 ${
            expanded ? "" : "hover:bg-white/5"
          }`}
        >
          <span>
            <span
              id="feedback-heading"
              className="block text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Send feedback
            </span>
            <span className="mt-2 block text-sm/6 text-muted">
              Found a bug, want a feature, or just have a thought? Send it
              straight to me.
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            /* Same duration as the panel, so the chevron and the card settle
             * together rather than one landing 60ms before the other. */
            className={`size-5 shrink-0 text-muted transition-transform duration-[360ms] ease-out motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path
              d="m4 6 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* grid-rows 0fr→1fr animates height without measuring. Height only:
         * fading the panel at the same time left the form legible while the
         * edge was still cutting through the middle of it, so the textarea read
         * as a torn sheet on the way out. */}
        <div
          id="feedback-panel"
          inert={!expanded}
          className={`grid transition-[grid-template-rows] duration-[360ms] ease-out motion-reduce:transition-none ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {/* Top padding lives inside the clipped panel so the form reveals
             * with clear space below the header instead of the textarea (and
             * its outward focus ring) butting straight up against it. */}
            <div
              /* The form rises into the space rather than being uncovered by
               * it: it waits for most of the opening, then fades up over the
               * last of it. Closing takes the fade first, so the card collapses
               * on an empty panel. */
              className={`px-8 pt-6 pb-8 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none sm:px-10 sm:pt-8 sm:pb-10 ${
                expanded
                  ? "translate-y-0 opacity-100 delay-150"
                  : "-translate-y-1 opacity-0"
              }`}
            >
              {status === "sent" ? (
                <p
                  role="status"
                  className="rounded-2xl border border-spark-teal/25 bg-spark-teal/10 px-4 py-3 text-sm text-spark-teal-soft"
                >
                  Thanks, your feedback is on its way. I read every note.
                </p>
              ) : (
                <form
                  onSubmit={onSubmit}
                  className="flex flex-col gap-4"
                  noValidate
                >
                  <div>
                    <label htmlFor="feedback-message" className="sr-only">
                      Your feedback
                    </label>
                    <textarea
                      ref={messageRef}
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
                    <label htmlFor="feedback-website">
                      Leave this field empty
                    </label>
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
          </div>
        </div>
      </div>
    </section>
  );
}
