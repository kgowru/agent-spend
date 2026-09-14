import Image from "next/image";

/*
 * Product imagery. Every shot is a real render of the app's own view tree,
 * produced by `AgentSpend --render` against a store of synthetic usage
 * (tools/seed-demo-store.py). No real project names or spend appear anywhere,
 * which is the reason the repo ships no captures of a live store.
 *
 * Each panel is framed in macOS window chrome so it reads as an application
 * rather than a floating screenshot, and the stoplight dots are decorative.
 */

type Shot = {
  src: string;
  width: number;
  height: number;
  title: string;
  body: string;
  alt: string;
};

const SHOTS: Shot[] = [
  {
    src: "/shots/shot-today.png",
    width: 812,
    height: 1632,
    title: "Today, and the days behind it",
    body: "The headline is what you have spent and the energy behind it. Under it, every day ranked, so a heavy session is obvious the moment it lands.",
    alt: "The AgentSpend home pane: a 14 day total of $87, a bar chart of daily cost, and a per day table of cost, energy and request counts.",
  },
  {
    src: "/shots/shot-savings.png",
    width: 812,
    height: 924,
    title: "What it would save you",
    body: "Ranked over your whole history, not just today. Each suggestion carries the number it is worth and the caveat that comes with it.",
    alt: "The savings pane: up to $45 identified, a recommendation to default to Sonnet 5, and the whole history replayed on each model.",
  },
  {
    src: "/shots/shot-sessions.png",
    width: 812,
    height: 641,
    title: "Session by session",
    body: "Which project, which branch, which model, and what the run cost. The hour histogram shows when the work actually happens.",
    alt: "The sessions pane: a by hour histogram and a list of sessions with project, branch, model, request count and cost.",
  },
  {
    src: "/shots/shot-method.png",
    width: 840,
    height: 412,
    title: "Every coefficient, in the open",
    body: "The energy model is a model. The app ships its per model baselines and sources so you can read them, and argue with them.",
    alt: "The methodology pane: a per model baseline table of watt hours per 1k input and output tokens, with each model's token share.",
  },
];

function WindowFrame({ shot }: { shot: Shot }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      {/* Title bar. Decorative, so it stays out of the accessibility tree. */}
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 border-b border-white/8 bg-white/4 px-4 py-3"
      >
        <span className="size-2.5 rounded-full bg-white/18" />
        <span className="size-2.5 rounded-full bg-white/13" />
        <span className="size-2.5 rounded-full bg-white/10" />
      </div>

      {/*
       * The panes have very different natural heights (the home pane is four
       * times the methodology table). Pinning every frame to one height and
       * anchoring the crop to the top keeps the grid rows aligned instead of
       * ragged; the fade at the bottom makes the cut read as deliberate
       * rather than clipped.
       */}
      <div className="relative max-h-[420px] overflow-hidden">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes="(min-width: 768px) 520px, 100vw"
          className="w-full"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-canvas/95"
        />
      </div>
    </div>
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

      {/* The menu bar item at its real size, pinned to a strip of "menu bar". */}
      <div className="mt-12 flex justify-center">
        <div className="glass inline-flex items-center gap-3 rounded-full py-2 pr-5 pl-3">
          <Image
            src="/shots/shot-menubar.png"
            alt="The AgentSpend menu bar item, showing a lightning bolt and today's cost."
            width={82}
            height={28}
            className="h-5 w-auto"
          />
          <span className="text-sm text-muted">
            Always visible. Updates while you work.
          </span>
        </div>
      </div>

      {/* Masonry, not a grid: the panes cap at different heights, and columns
       * pack them tightly instead of leaving a row's worth of dead space under
       * the shorter one. */}
      <div className="mt-14 columns-1 gap-6 md:columns-2">
        {SHOTS.map((shot) => (
          <figure key={shot.src} className="mb-10 break-inside-avoid">
            <WindowFrame shot={shot} />
            <figcaption className="mt-5">
              <h3 className="text-lg font-medium">{shot.title}</h3>
              <p className="mt-2 text-sm/6 text-muted">{shot.body}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted/80">
        Example figures from a demo dataset. Yours come from your own logs.
      </p>
    </section>
  );
}
