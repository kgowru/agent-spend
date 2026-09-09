import { BLOG_URL, DONATE_URL } from "@/lib/site";

/**
 * Renders only once DONATE_URL is set, so the page ships cleanly before the
 * Buy Me a Coffee or Ko-fi account exists.
 */
export function Support() {
  if (!DONATE_URL) return null;

  return (
    <section
      aria-labelledby="support-heading"
      className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24"
    >
      <div className="glass rounded-3xl p-8 text-center sm:p-12">
        <h2
          id="support-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Free, and staying that way
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg/8 text-muted">
          AgentSpend is free and MIT licensed. If it changed how you work you
          can buy me a coffee. It is optional and unlocks nothing.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-ink px-7 py-3.5 text-base font-medium text-canvas transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:w-auto"
          >
            Buy me a coffee
          </a>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted underline underline-offset-4 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
          >
            Read how the model was built
          </a>
        </div>
      </div>
    </section>
  );
}
