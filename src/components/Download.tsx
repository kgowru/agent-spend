import { DOWNLOAD_URL, REPO_URL } from "@/lib/site";
import { MetalButton } from "./MetalButton";

const STEPS = [
  "Download AgentSpend.dmg from the latest release.",
  "Open it and drag AgentSpend into Applications.",
  "Launch it. A lightning bolt appears in your menu bar showing today's cost.",
];

export function Download() {
  return (
    <section
      id="install"
      aria-labelledby="install-heading"
      className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-20 sm:py-24"
    >
      <div className="glass rounded-3xl p-8 sm:p-12">
        <h2
          id="install-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Install in about 30 seconds
        </h2>

        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-4 sm:flex-col sm:gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 font-mono text-sm text-muted"
              >
                {i + 1}
              </span>
              <p className="text-sm/6 text-muted">{step}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <MetalButton className="w-full sm:w-auto">
            <a
              href={DOWNLOAD_URL}
              className="w-full rounded-full px-7 py-3.5 text-center text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:w-auto"
            >
              Download for macOS
            </a>
          </MetalButton>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted underline underline-offset-4 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
          >
            Or build it from source
          </a>
        </div>
      </div>
    </section>
  );
}
