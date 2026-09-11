"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * The two proof cards, animated. On scroll into view each number counts up from
 * zero and the usage bars grow from the baseline. Everything degrades to the
 * final, static state when JS is off or the visitor prefers reduced motion, so
 * the real figures are always present for no-JS and screen-reader users.
 *
 * `armed` gates the whole effect: false during SSR / first paint / reduced
 * motion (numbers show their final value, bars show full height), true only
 * after mount when motion is allowed. `active` (armed + in view) is what
 * actually triggers the run — so the reset-to-zero happens off screen, below
 * the fold, never as a visible flash.
 */

type Tone = "teal" | "orange";

const TONE: Record<Tone, { base: string; soft: string }> = {
  teal: { base: "var(--color-spark-teal)", soft: "var(--color-spark-teal-soft)" },
  orange: {
    base: "var(--color-spark-orange)",
    soft: "var(--color-spark-orange-soft)",
  },
};

/* Illustrative per-session usage, as a share of each bar's track height. */
const BARS_DOLLARS = [34, 52, 41, 68, 47, 80, 59, 73, 44, 63, 92, 55];
const BARS_ENERGY = [28, 46, 38, 61, 72, 50, 85, 66, 40, 58, 77, 48];

const DURATION_MS = 1100;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/* Hydration-safe "are we on the client yet" and reduced-motion reads, via
 * useSyncExternalStore so neither needs a setState-in-effect. Same pattern as
 * MetalButton. */
const noopSubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Animate 0 → target once `active` turns true. Returns null until then, so the
 *  caller can show the final value while disarmed. */
function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState<number | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setValue(target * easeOutCubic(t));
      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [active, target]);

  return value;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
      {children}
    </span>
  );
}

function BarGraph({
  bars,
  tone,
  armed,
  active,
}: {
  bars: number[];
  tone: Tone;
  armed: boolean;
  active: boolean;
}) {
  const { base, soft } = TONE[tone];
  // Disarmed → full height and static. Armed but not yet in view → collapsed.
  const grown = !armed || active;

  return (
    <div
      aria-hidden="true"
      className="mt-6 flex h-14 items-end gap-1.5"
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 origin-bottom rounded-t-[2px] transition-transform duration-700 ease-out"
          style={{
            height: `${height}%`,
            background: `linear-gradient(to top, ${base}, ${soft})`,
            transform: grown ? "scaleY(1)" : "scaleY(0)",
            transitionDelay: armed ? `${i * 45}ms` : "0ms",
          }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  kicker,
  target,
  format,
  bars,
  tone,
  description,
  armed,
  active,
}: {
  kicker: string;
  target: number;
  format: (value: number) => string;
  bars: number[];
  tone: Tone;
  description: string;
  armed: boolean;
  active: boolean;
}) {
  const count = useCountUp(target, active);
  // Disarmed → real value (SSR / no-JS / reduced motion). Armed but pre-view →
  // zero, waiting off screen. In view → the counting value.
  const text = armed ? format(count ?? 0) : format(target);

  return (
    <div className="glass rounded-3xl p-7 sm:p-8">
      <Kicker>{kicker}</Kicker>
      <p className="mt-6 font-mono text-5xl font-semibold tabular-nums sm:text-6xl">
        {text}
      </p>
      <BarGraph bars={bars} tone={tone} armed={armed} active={active} />
      <p className="mt-6 text-sm/6 text-muted">{description}</p>
    </div>
  );
}

const fmtDollars = (v: number) => `$${v.toFixed(2)}`;
const fmtEnergy = (v: number) => `${Math.round(v)} Wh`;

export function ProofMetrics() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Armed once we're on the client and motion is allowed; reduced motion and
  // no-JS keep the final, static state.
  const isClient = useIsClient();
  const reduce = usePrefersReducedMotion();
  const armed = isClient && !reduce;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const active = armed && inView;

  return (
    <div ref={ref} className="mt-12 grid gap-5 md:grid-cols-2">
      <MetricCard
        kicker="Dollars"
        target={12.47}
        format={fmtDollars}
        bars={BARS_DOLLARS}
        tone="teal"
        description="Arithmetic on Anthropic’s published API rates: input, output, cache writes, and cache reads at a tenth of the input price."
        armed={armed}
        active={active}
      />
      <MetricCard
        kicker="Energy"
        target={38}
        format={fmtEnergy}
        bars={BARS_ENERGY}
        tone="orange"
        description="A model, not a measurement. It could be off by a lot, and the app shows you by how much."
        armed={armed}
        active={active}
      />
    </div>
  );
}
