import type { ReactNode } from "react";
import { C, fadeMask } from "./screens/chrome";
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
  alt: string;
  /** Tailwind column span on the bento grid at md and up. */
  span: string;
};

const SHOTS: Shot[] = [
  {
    key: "today",
    screen: <ScreenToday />,
    title: "Daily spend",
    alt: "The AgentSpend home pane, on its 14 day window: a total of $87, a bar chart of daily cost, and a per day table of cost, energy and request counts.",
    span: "md:col-span-3",
  },
  {
    key: "savings",
    screen: <ScreenSavings />,
    title: "Suggested savings",
    alt: "The savings pane: up to $45 identified against $542 spent, the 26.2 kWh behind it, then ranked suggestions, each with what it is worth and the evidence behind it.",
    /* The full height of the right-hand column. It is the longest pane in the
     * app and the one that has to argue for itself, so it gets the room to
     * show more than a headline and the first card. */
    span: "md:col-span-3 md:row-span-2",
  },
  {
    key: "sessions",
    screen: <ScreenSessions />,
    title: "Session spend",
    alt: "The sessions pane: a chart of when today's work happened, then each run with its project, branch, model, request count and cost.",
    span: "md:col-span-3",
  },
];

/*
 * The shortest a screen is cropped to, which is what the single-height tiles
 * get and what sets the grid's row height. Savings spans both rows and its
 * screen grows into whatever that leaves, so the pane with the most to say is
 * the one you see most of.
 */
const SCREEN_H = 248;

/* A tile is the top of a pane and nothing else, so the crop runs out early and
 * gently — see fadeMask for why the box it lands on has to be SCREEN_H tall. */
const SCREEN_FADE = fadeMask(
  "linear-gradient(to bottom, #000 0%, #000 58%, rgb(0 0 0 / 0.55) 82%, transparent 100%)",
);

/* The frame's hairline, fading out as it descends so the screen sits in
 * something that dissolves into the tile instead of a closed box. */
const FADING_BORDER = {
  maskImage: "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.35) 55%, transparent 95%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, #000 0%, rgb(0 0 0 / 0.35) 55%, transparent 95%)",
} as const;

function Tile({ shot }: { shot: Shot }) {
  return (
    /* `min-w-0`: a grid item defaults to min-width:auto, so the screens' own
     * min-content width (fixed numeric columns plus long strings) would push
     * the tile wider than the viewport rather than letting the pane compress. */
    <figure className={`glass flex min-w-0 flex-col rounded-3xl p-3 ${shot.span}`}>
      {/*
       * The screen sits inset in its own frame rather than bleeding to the
       * tile's edges, where the rounded clip would eat the first character of
       * every line and the last column of every table. The crop is a floor
       * rather than a fixed height: `flex-1` lets the tall tile's screen take
       * the rest of its card, and the pane runs out under the fade either way.
       */}
      <div
        className="relative flex-1 overflow-hidden rounded-2xl"
        style={{ minHeight: SCREEN_H }}
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

      {/* A name for the pane and nothing else. The paragraph that used to sit
       * under it described what the screen above already shows. The screen
       * reader description has not gone anywhere: it is the `alt` on the
       * figure, which is now the only place it is written down. */}
      <figcaption className="px-4 py-5 sm:px-5 sm:py-6">
        <h3 className="text-lg font-medium">{shot.title}</h3>
      </figcaption>
    </figure>
  );
}

export function Showcase() {
  return (
    /* No heading and no strip of menu bar: the hero opens with the item and
     * the window hanging off it, so both were saying a second time what the
     * visitor had already scrolled past. Named for the nav link that lands
     * here, since there is no longer a heading to name it. */
    <section
      id="showcase"
      aria-label="Features"
      className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-20 sm:py-28"
    >
      {/* Tiles stretch to the row's height. The screens fill that height with
       * the app's own surface, so a shorter pane reads as the app having
       * nothing more to show rather than as a gap in the layout. */}
      <div className="grid gap-5 md:grid-cols-6">
        {SHOTS.map((shot) => (
          <Tile key={shot.key} shot={shot} />
        ))}
      </div>
    </section>
  );
}
