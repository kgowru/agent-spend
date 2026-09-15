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
function Bluetooth() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-[15px]">
      <path
        d="m5.5 4.5 5 7L8 13.5v-11l2.5 2-5 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Battery() {
  return (
    <svg viewBox="0 0 26 16" fill="none" className="h-[15px] w-[24px]">
      <rect
        x="1"
        y="4"
        width="21"
        height="9"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.75"
      />
      <rect x="2.8" y="5.8" width="14" height="5.4" rx="1.5" fill="currentColor" />
      <path
        d="M23.6 7.2v2.6c.8-.3 1.2-.8 1.2-1.3s-.4-1-1.2-1.3Z"
        fill="currentColor"
        opacity="0.75"
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
      <path d="M2 5h12M2 11h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
      <circle cx="10.5" cy="5" r="2.1" fill="currentColor" />
      <circle cx="5.5" cy="11" r="2.1" fill="currentColor" />
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
      <div
        className="relative mx-auto flex h-9 max-w-3xl items-center justify-center gap-3.5 rounded-lg border-t border-white/10 bg-white/6 px-4 backdrop-blur-xl sm:gap-4"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)",
        }}
      >
        <div aria-hidden="true" className="flex items-center gap-3.5 text-ink/45 sm:gap-4">
          <Bluetooth />
          <Battery />
        </div>

        <Image
          src="/shots/shot-menubar.png"
          alt="The AgentSpend menu bar item, showing a lightning bolt and today's cost."
          width={163}
          height={47}
          className="h-[18px] w-auto"
          unoptimized
        />

        <div aria-hidden="true" className="flex items-center gap-3.5 text-ink/45 sm:gap-4">
          <Wifi />
          <Search />
          <ControlCentre />
          <span className="text-[13px] whitespace-nowrap">Sun 9:41</span>
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
