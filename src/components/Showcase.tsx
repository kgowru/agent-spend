import Image from "next/image";

/*
 * Product imagery. Every shot is a real render of the app's own view tree,
 * produced by `AgentSpend --render` against a store of synthetic usage
 * (tools/seed-demo-store.py). No real project names or spend appear anywhere,
 * which is the reason the repo ships no captures of a live store.
 *
 * The panes are cropped to their subject at asset time (tools/prep-shots.py),
 * so a card shows a legible headline rather than a whole pane shrunk to fit.
 * Here each one is bled into its tile and faded at the edges instead of being
 * boxed in window chrome — the hard-edged title bar read as a seam.
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
};

const SHOTS: Shot[] = [
  {
    src: "/shots/shot-today.png",
    width: 812,
    height: 718,
    title: "Today, and the days behind it",
    body: "The headline is what you have spent and the energy behind it. Under it, every day ranked, so a heavy session is obvious the moment it lands.",
    alt: "The AgentSpend home pane: a 14 day total of $87, a bar chart of daily cost, and a per day table of cost, energy and request counts.",
    span: "md:col-span-4",
  },
  {
    src: "/shots/shot-savings.png",
    width: 812,
    height: 535,
    title: "What it would save you",
    body: "Ranked over your whole history, not just today. Each suggestion carries the number it is worth and the caveat that comes with it.",
    alt: "The savings pane: up to $45 identified, and a recommendation to default to Sonnet 5 while reserving the top tier for hard work.",
    span: "md:col-span-2",
  },
  {
    src: "/shots/shot-sessions.png",
    width: 812,
    height: 564,
    title: "Session by session",
    body: "Which project, which branch, which model, and what the run cost.",
    alt: "The sessions pane: a by hour histogram and a list of sessions with project, branch, model, request count and cost.",
    span: "md:col-span-3",
  },
  {
    src: "/shots/shot-method.png",
    width: 840,
    height: 412,
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

function MenuBarStrip() {
  return (
    <div className="mt-12">
      {/*
       * The item as it actually sits: in a strip of menu bar, which fades out
       * left and right rather than ending in a pill. Centred rather than right
       * aligned like the real menu bar, so it sits on the section's axis.
       */}
      <div
        className="relative mx-auto flex h-9 max-w-2xl items-center justify-center rounded-lg border-t border-white/10 bg-white/6 backdrop-blur-xl"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
        }}
      >
        <Image
          src="/shots/shot-menubar.png"
          alt="The AgentSpend menu bar item, showing a lightning bolt and today's cost."
          width={82}
          height={28}
          className="h-[18px] w-auto"
        />
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
          sizes="(min-width: 768px) 560px, 100vw"
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
