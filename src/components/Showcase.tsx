import Image from "next/image";

/*
 * Product imagery. Every shot is a real render of the app's own view tree,
 * produced by `AgentSpend --render` against a store of synthetic usage
 * (tools/seed-demo-store.py). No real project names or spend appear anywhere,
 * which is the reason the repo ships no captures of a live store.
 *
 * The panes are cropped to their subject at asset time (tools/prep-shots.py),
 * so a card shows a legible headline rather than a whole pane shrunk to fit,
 * and rendered at AGENTSPEND_RENDER_SCALE=4 so a 2x display has pixels to
 * spare rather than upscaling. Each sits inset in its own frame with a
 * hairline that fades out, instead of being boxed in window chrome — the
 * hard-edged title bar read as a seam.
 */

type Shot = {
  src: string;
  width: number;
  height: number;
  title: string;
  body: string;
  alt: string;
  /** Tailwind column span on the bento grid at md and up. */
  span: string;
  /** Rendered frame width, so Next picks a candidate that survives a
   *  2x display instead of upscaling one sized for a narrower tile. The
   *  breakpoint is in `rem` to match what Tailwind's `md:` compiles to
   *  (48rem): stated in px, the two desync the moment a visitor raises their
   *  browser's default font size, and the grid goes single column while the
   *  browser is still being told each tile is a narrow bento cell. */
  sizes: string;
};

const SHOTS: Shot[] = [
  {
    src: "/shots/shot-today.png",
    sizes: "(min-width: 48rem) 620px, 100vw",
    width: 1624,
    height: 1435,
    title: "Today, and the days behind it",
    body: "The headline is what you have spent and the energy behind it. Under it, every day ranked, so a heavy session is obvious the moment it lands.",
    alt: "The AgentSpend home pane: a 14 day total of $87, a bar chart of daily cost, and a per day table of cost, energy and request counts.",
    span: "md:col-span-4",
  },
  {
    src: "/shots/shot-savings.png",
    sizes: "(min-width: 48rem) 290px, 100vw",
    width: 1624,
    height: 1071,
    title: "What it would save you",
    body: "Ranked over your whole history, not just today. Each suggestion carries the number it is worth and the caveat that comes with it.",
    alt: "The savings pane: up to $45 identified, and a recommendation to default to Sonnet 5 while reserving the top tier for hard work.",
    span: "md:col-span-2",
  },
  {
    src: "/shots/shot-sessions.png",
    sizes: "(min-width: 48rem) 455px, 100vw",
    width: 1624,
    height: 1129,
    title: "Session by session",
    body: "Which project, which branch, which model, and what the run cost.",
    alt: "The sessions pane: a by hour histogram and a list of sessions with project, branch, model, request count and cost.",
    span: "md:col-span-3",
  },
  {
    src: "/shots/shot-method.png",
    sizes: "(min-width: 48rem) 455px, 100vw",
    width: 1680,
    height: 804,
    title: "Every coefficient, in the open",
    body: "The energy model is a model. The app ships its per model baselines and sources so you can read them, and argue with them.",
    alt: "The methodology pane: a per model baseline table of watt hours per 1k input and output tokens, with each model's token share.",
    span: "md:col-span-3",
  },
];

/* Softens the bottom of a capture that is taller than its frame, so it runs
 * out rather than stopping on a cut line. Starts late: the capture is sized to
 * the frame's width, so most of it should be legible, not faded. */
const BOTTOM_FADE = {
  maskImage: "linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%)",
} as const;

/* The frame's hairline, fading out as it descends so the capture sits in
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
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-[15px]">
      {[4, 8, 12].map((y) =>
        [4, 8, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" />),
      )}
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-[15px]">
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
    <svg viewBox="0 0 18 16" fill="none" className="size-[16px]">
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
    <svg viewBox="0 0 27 16" fill="none" className="h-[14px] w-[25px]">
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
  return (
    <svg viewBox="0 0 18 16" fill="none" className="size-[16px]">
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
    <svg viewBox="0 0 16 16" fill="none" className="size-[15px]">
      <rect x="1.4" y="2.6" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <rect x="1.4" y="8.8" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <circle cx="10.6" cy="4.9" r="1.35" fill="currentColor" />
      <circle cx="5.4" cy="11.1" r="1.35" fill="currentColor" />
    </svg>
  );
}

function Search() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-[15px]">
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
          <span className="hidden text-[13px] tracking-tight sm:inline">91%</span>
          <Battery />
          <Wifi />
          <span className="hidden sm:block">
            <Search />
          </span>
          <span className="hidden sm:block">
            <ControlCentre />
          </span>
          <span className="hidden text-[13px] whitespace-nowrap md:inline">
            Mon Sep 14 10:04 PM
          </span>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Always visible. Updates while you work.
      </p>
    </div>
  );
}

function Tile({ shot }: { shot: Shot }) {
  return (
    <figure className={`glass flex flex-col rounded-3xl p-3 ${shot.span}`}>
      {/*
       * The capture sits inset in its own frame rather than bleeding to the
       * tile's edges. Bleeding meant the tile's rounded clip ate the first
       * character of every line and the last column of every table; sized to
       * the frame's width instead, the whole pane stays legible.
       */}
      {/* Hugs the capture rather than stretching to the bento row's height:
       * a stretched frame left a black void under the shorter panes. */}
      <div className="relative overflow-hidden rounded-2xl bg-black/25">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes={shot.sizes}
          className="w-full"
          style={BOTTOM_FADE}
        />
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
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg/8 text-pretty text-muted">
        One click from the menu bar. Here is what it shows you.
      </p>

      <MenuBarStrip />

      {/* `items-start` so a tile ends under its own caption. Stretching them to
       * the row's height left a slab of empty glass below the shorter ones. */}
      <div className="mt-14 grid items-start gap-5 md:grid-cols-6">
        {SHOTS.map((shot) => (
          <Tile key={shot.src} shot={shot} />
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted/80">
        Example figures from a demo dataset. Yours come from your own logs.
      </p>
    </section>
  );
}
