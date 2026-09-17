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
