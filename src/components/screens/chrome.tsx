import type { CSSProperties, ReactNode } from "react";

/*
 * Shared chrome for the product screens.
 *
 * These are HTML recreations of the app's own panes, not captures: text stays
 * vector, so it is crisp at any zoom or pixel density, selectable, and legible
 * to a screen reader. Every colour here was sampled from a real
 * `AgentSpend --render` capture of the panes they replace, so the recreation
 * matches the app rather than approximating it.
 *
 * The figures are the same synthetic demo dataset the captures used
 * (tools/seed-demo-store.py) — no real project names or spend.
 */

export const C = {
  surface: "#1e1e1e",
  inset: "#262626",
  primary: "#dddddd",
  secondary: "#9a9a9a",
  tertiary: "#565656",
  rule: "#343434",
  blue: "#0480dd",
  orange: "#dd812d",
  /* macOS dark mode's system green, yellow and red, which is the traffic light
   * the 1d pane tints today's figure with. */
  green: "#30d158",
  yellow: "#ffd426",
  red: "#ff453a",
} as const;

/* The app is SF on macOS; fall back gracefully elsewhere. Set once on the
 * screen root so every pane inherits it. */
export const APP_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';

/** Tabular figures, so columns of numbers line up like the real app's. */
export const NUM: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
};

/**
 * A pane of the app. Fills its tile rather than being pinned to the app's own
 * 396pt width: the screens are rebuilt as HTML precisely so they can reflow
 * instead of being scaled down until the type goes soft.
 */
export function Screen({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col text-[13px] leading-normal ${className}`}
      style={{ background: C.surface, color: C.primary, fontFamily: APP_FONT }}
    >
      {children}
    </div>
  );
}

/**
 * Crops a pane so it runs out under a fade rather than stopping on a cut line,
 * which is what says there is more pane below.
 *
 * The gradient is sized to the element's own box, so whatever this lands on has
 * to be exactly the crop height — on an auto-height wrapper the whole fade
 * sits below the visible window and the crop reads as a hard cut. `no-repeat`
 * plus an explicit size stops the gradient tiling down over content that
 * overflows the box.
 */
export function fadeMask(gradient: string): CSSProperties {
  return {
    maskImage: gradient,
    WebkitMaskImage: gradient,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
  };
}

export function Rule({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full ${className}`} style={{ background: C.rule }} />;
}

/*
 * AppKit's segmented control in dark mode: a sunken track with the selected
 * segment raised out of it. Kept here with the rest of the app's chrome, and
 * worn by SegmentedControl, which is the only thing that draws it.
 */
export const TRACK = {
  className:
    "flex h-[22px] shrink-0 items-stretch gap-[1px] self-start rounded-[7px] p-[1px]",
  style: { background: "#2c2c2c" } satisfies CSSProperties,
};

export const SEGMENT =
  "flex items-center justify-center rounded-[6px] px-[13px] text-[12px]";

export function segmentStyle(selected: boolean): CSSProperties {
  return selected
    ? {
        background: "#4c4c4c",
        color: "#ffffff",
        boxShadow:
          "inset 0 1px 0 0 rgb(255 255 255 / 0.10), 0 1px 2px 0 rgb(0 0 0 / 0.35)",
      }
    : { color: C.primary };
}

/*
 * There is no drawn version of this picker any more. A pane only carries one
 * where it works, which is the hero window; the showcase tiles are stills, and
 * a control that cannot be pressed is worse than no control at all.
 */

/** A small caps-ish label, the app's `.caption` in secondary. */
export function Label({
  children,
  tone = C.secondary,
  className = "",
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span className={`text-[11px] ${className}`} style={{ color: tone }}>
      {children}
    </span>
  );
}

/**
 * The big rounded figure the app uses for a headline number
 * (`.system(size: 28, weight: .medium, design: .rounded)`).
 */
export function Headline({
  children,
  tone = C.primary,
  className = "",
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div
      className={`text-[30px] leading-[1.1] font-medium tracking-[-0.01em] ${className}`}
      style={{ color: tone, ...NUM }}
    >
      {children}
    </div>
  );
}
