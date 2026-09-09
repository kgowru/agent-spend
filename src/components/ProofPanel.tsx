/**
 * The app's thesis in one glance: one number is arithmetic, the other is a
 * model with a wide range.
 *
 * The figures shown are invented, because no real total exists in the repo and
 * no sanitized screenshot is committed. For an app whose whole pitch is telling
 * you how much to trust a number, an unlabelled fake would undercut itself, so
 * this is a <figure> with a visible caption saying the figures are examples.
 */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
      {children}
    </span>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "exact" | "estimate";
}) {
  const styles =
    tone === "exact"
      ? "bg-spark-teal/15 text-spark-teal-soft"
      : "bg-spark-orange/15 text-spark-orange-soft";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function ProofPanel() {
  return (
    <section
      aria-labelledby="proof-heading"
      className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28"
    >
      <figure>
        <h2
          id="proof-heading"
          className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          AgentSpend estimates your cost and energy
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="glass rounded-3xl p-7 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <Kicker>Dollars</Kicker>
              <Pill tone="exact">exact</Pill>
            </div>
            <p className="mt-6 font-mono text-5xl font-semibold tabular-nums sm:text-6xl">
              $12.47
            </p>
            {/* Spacer matching the energy card's band, so the captions line up. */}
            <div aria-hidden="true" className="mt-6 h-2" />
            <p className="mt-6 text-sm/6 text-muted">
              Arithmetic on Anthropic&rsquo;s published API rates: input,
              output, cache writes, and cache reads at a tenth of the input
              price.
            </p>
          </div>

          <div className="glass rounded-3xl p-7 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <Kicker>Energy</Kicker>
              <Pill tone="estimate">estimate</Pill>
            </div>
            <p className="mt-6 font-mono text-5xl font-semibold tabular-nums sm:text-6xl">
              38 Wh
            </p>

            {/* The range, drawn. This is the point of the whole panel. */}
            <div
              aria-hidden="true"
              className="relative mt-6 h-2 rounded-full bg-white/8"
            >
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: "12%",
                  right: "18%",
                  background:
                    "linear-gradient(90deg, transparent, var(--color-spark-orange) 45%, transparent)",
                  opacity: 0.75,
                }}
              />
              <div className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-spark-orange-soft" />
            </div>

            <p className="mt-6 text-sm/6 text-muted">
              A model, not a measurement. It could be off by a lot, and the app
              shows you by how much.
            </p>
          </div>
        </div>

        <figcaption className="mt-10 text-center text-sm text-muted/80">
          Example figures. Yours come from your own logs.
        </figcaption>
      </figure>
    </section>
  );
}
