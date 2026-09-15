import Image from "next/image";
import type { ReactNode } from "react";
import { MenuBarClock } from "./MenuBarClock";
import { C } from "./screens/chrome";
import { ScreenToday } from "./screens/ScreenToday";
import { ScreenSavings } from "./screens/ScreenSavings";
import { ScreenSessions } from "./screens/ScreenSessions";

/*
 * Product screens, rebuilt as HTML rather than shipped as screenshots. A raster
 * softens the moment it is displayed wider than it was captured, and these
 * tiles do exactly that; as markup the type stays vector at any zoom or pixel
 * density, and it is selectable and readable to a screen reader.
 *
 * The panes are faithful to the app: every colour was sampled from a real
 * `AgentSpend --render` capture, the structure follows the SwiftUI source, and
 * the figures are the same synthetic demo dataset the captures used
 * (tools/seed-demo-store.py), so no real project names or spend appear. They
 * are a recreation though, so they have to be revisited when the panes change.
 *
 * Each sits inset in its own frame with a hairline that fades out, rather than
 * boxed in window chrome, which read as a seam.
 */

type Shot = {
  key: string;
  screen: ReactNode;
  title: string;
  body: string;
  alt: string;
  /** Tailwind column span on the bento grid at md and up. */
  span: string;
};

const SHOTS: Shot[] = [
  {
    key: "today",
    screen: <ScreenToday />,
    title: "Daily spend",
    body: "The headline is what you have spent and the energy behind it. Under it, every day ranked, so a heavy session is obvious the moment it lands.",
    alt: "The AgentSpend home pane: a 14 day total of $87, a bar chart of daily cost, and a per day table of cost, energy and request counts.",
    span: "md:col-span-3",
  },
  {
    key: "savings",
    screen: <ScreenSavings />,
    title: "Suggested savings",
    body: "Ranked over your whole history, not just today. Each suggestion carries the number it is worth and the caveat that comes with it.",
    alt: "The savings pane: up to $45 identified, then ranked suggestions, each with what it is worth and the evidence behind it.",
    span: "md:col-span-3",
  },
  {
    key: "sessions",
    screen: <ScreenSessions />,
    title: "Session spend",
    body: "Which project, which branch, which model, and what the run cost.",
    alt: "The sessions pane: a list of sessions with project, branch, model, request count and cost.",
    span: "md:col-span-6",
  },
];

/*
 * Every screen is cropped to the same height, so a tile shows the top of a
 * pane rather than all of it. Two things fall out of that: the rows line up
 * without having to pad the shorter panes, and the cards stay short enough
 * that the captions under them are still on screen together.
 */
const SCREEN_H = 248;

/*
 * The crop runs out rather than stopping on a cut line, which is what says
 * there is more pane below.
 *
 * The gradient is sized to the element's own box, so the element this sits on
 * has to be exactly the crop height — on an auto-height wrapper the whole fade
 * lands below the visible window and the crop reads as a hard cut. `no-repeat`
 * plus an explicit size stops the gradient tiling down over content that
 * overflows the box.
 */
const FADE_GRADIENT =
  "linear-gradient(to bottom, #000 0%, #000 58%, rgb(0 0 0 / 0.55) 82%, transparent 100%)";

const SCREEN_FADE = {
  maskImage: FADE_GRADIENT,
  WebkitMaskImage: FADE_GRADIENT,
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskSize: "100% 100%",
  WebkitMaskSize: "100% 100%",
} as const;

/* The frame's hairline, fading out as it descends so the screen sits in
 * something that dissolves into the tile instead of a closed box. */
const FADING_BORDER = {
  maskImage: "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.35) 55%, transparent 95%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.35) 55%, transparent 95%)",
} as const;

/*
 * Stand-in glyphs for the status items our own sits between. Drawn rather
 * than captured: a screenshot of a real menu bar would carry whatever the
 * machine happened to be running, which is how the first pass leaked private
 * data. Generic shapes, decorative only.
 */
function DotGrid() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="block size-[15px]">
      {[4, 8, 12].map((y) =>
        [4, 8, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" />),
      )}
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="block size-[15px]">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="m5.2 8.2 2 2 3.6-4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cloud() {
  return (
    <svg viewBox="0 0 18 16" fill="none" className="block size-[16px]">
      <path
        d="M4.9 12.2h7.6a2.9 2.9 0 0 0 .3-5.8 4.1 4.1 0 0 0-7.8-.9 3.35 3.35 0 0 0-.1 6.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Battery() {
  return (
    <svg viewBox="0 0 27 16" fill="none" className="block h-[14px] w-[25px]">
      <rect
        x="0.6"
        y="3.6"
        width="22"
        height="9.2"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.6"
      />
      {/* ~91%, matching a nearly full charge. */}
      <rect x="2.2" y="5.2" width="18.8" height="6" rx="1.9" fill="currentColor" />
      <path
        d="M24.2 6.6v3c.9-.3 1.4-.9 1.4-1.5s-.5-1.2-1.4-1.5Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}

function Wifi() {
  /* The arcs top out around y 3.05 and the dot bottoms out at 14.65, so the
   * glyph's own centre is ~0.85 below the viewBox centre. Offsetting the
   * viewBox by that much centres the mark optically, rather than centring a
   * box the mark does not fill evenly. */
  return (
    <svg viewBox="0 0.85 18 16" fill="none" className="block size-[16px]">
      <path
        d="M1.6 6.1a10.5 10.5 0 0 1 14.8 0M4.2 8.8a6.8 6.8 0 0 1 9.6 0M6.8 11.5a3.1 3.1 0 0 1 4.4 0"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <circle cx="9" cy="13.6" r="1.05" fill="currentColor" />
    </svg>
  );
}

function ControlCentre() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="block size-[15px]">
      <rect x="1.4" y="2.6" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <rect x="1.4" y="8.8" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <circle cx="10.6" cy="4.9" r="1.35" fill="currentColor" />
      <circle cx="5.4" cy="11.1" r="1.35" fill="currentColor" />
    </svg>
  );
}

function Search() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="block size-[15px]">
      <circle cx="7.2" cy="7.2" r="4.6" stroke="currentColor" strokeWidth="1.35" />
      <path d="m10.7 10.7 3 3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function MenuBarStrip() {
  return (
    <div className="mt-12">
      {/*
       * The item as it actually sits: in a strip of menu bar, among the status
       * items it shares the corner with, fading out left and right rather than
       * ending in a pill. Centred rather than right aligned like the real menu
       * bar, so it sits on the section's axis. The neighbours are dimmer than
       * our own item, which is the thing being pointed at.
       */}
      {/*
       * Three columns with equal-weight flanks, so the app's own item lands on
       * the section's centre line. Centring the row as a whole put it off axis,
       * because the Apple cluster on the right is far wider than the
       * third-party glyphs on the left.
       */}
      <div
        className="relative mx-auto grid h-9 max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border-t border-white/10 bg-white/6 px-4 backdrop-blur-xl"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        {/*
         * Other third-party items, which is what our own sits among. They drop
         * out as the strip narrows: on a phone the full cluster overflows and
         * squeezes the one item the section is actually about.
         */}
        <div
          aria-hidden="true"
          className="flex items-center justify-end gap-4 text-ink/45"
        >
          <span className="hidden md:block">
            <DotGrid />
          </span>
          <span className="hidden sm:block">
            <CheckCircle />
          </span>
          <Cloud />
        </div>

        <Image
          src="/shots/shot-menubar.png"
          alt="The AgentSpend menu bar item, showing a lightning bolt and today's cost."
          width={163}
          height={47}
          className="h-[18px] w-auto"
          unoptimized
        />

        {/* The system cluster macOS pins to the right of everything else. */}
        <div
          aria-hidden="true"
          className="flex items-center justify-start gap-3 text-ink/45"
        >
          {/* `leading-none`: the row centres each item's box, and a default
            * line box is taller than the digits it holds, which would sit the
            * text off the icons' centre line. */}
          <span className="hidden text-[13px] leading-none tracking-tight sm:inline">
            91%
          </span>
          <Battery />
          <Wifi />
          <span className="hidden sm:block">
            <Search />
          </span>
          <span className="hidden sm:block">
            <ControlCentre />
          </span>
          <span className="hidden md:inline">
            <MenuBarClock />
          </span>
        </div>
      </div>
    </div>
  );
}

function Tile({ shot }: { shot: Shot }) {
  return (
    /* `min-w-0`: a grid item defaults to min-width:auto, so the screens' own
     * min-content width (fixed numeric columns plus long strings) would push
     * the tile wider than the viewport rather than letting the pane compress. */
    <figure className={`glass flex min-w-0 flex-col rounded-3xl p-3 ${shot.span}`}>
      {/*
       * The screen sits inset in its own frame rather than bleeding to the
       * tile's edges, where the rounded clip would eat the first character of
       * every line and the last column of every table. Cropped to a fixed
       * height: the point is the top of each pane, and the rest running out
       * under the fade says there is more of it.
       */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ height: SCREEN_H }}
      >
        {/* Announced as a single described graphic. The markup underneath is
         * real text, but read out it is a wall of demo figures; the summary is
         * what a listener actually wants from an illustration.
         *
         * Pinned to the crop box (rather than left to size to its content) so
         * the fade gradient spans the visible height — see SCREEN_FADE. It
         * carries the app surface too, so a pane with less content than the
         * crop still reads as app rather than as a gap in the tile. */}
        <div
          role="img"
          aria-label={shot.alt}
          className="absolute inset-0 overflow-hidden"
          style={{ ...SCREEN_FADE, background: C.surface }}
        >
          {/* Left at its natural height: `Screen` is a column flex container,
           * so handing it a definite height would let overflowing rows shrink
           * to fit instead of running out of frame under the fade. */}
          <div className="absolute inset-x-0 top-0">{shot.screen}</div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl border border-white/12"
          style={FADING_BORDER}
        />
      </div>

      <figcaption className="px-4 pt-5 pb-4 sm:px-5 sm:pt-6 sm:pb-5">
        <h3 className="text-lg font-medium">{shot.title}</h3>
        <p className="mt-2 text-sm/6 text-muted">{shot.body}</p>
      </figcaption>
    </figure>
  );
}

export function Showcase() {
  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-20 sm:py-28"
    >
      <h2
        id="showcase-heading"
        className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        A menu bar away
      </h2>

      <MenuBarStrip />

      {/* Tiles stretch to the row's height. The screens fill that height with
       * the app's own surface, so a shorter pane reads as the app having
       * nothing more to show rather than as a gap in the layout. */}
      <div className="mt-14 grid gap-5 md:grid-cols-6">
        {SHOTS.map((shot) => (
          <Tile key={shot.key} shot={shot} />
        ))}
      </div>
    </section>
  );
}
