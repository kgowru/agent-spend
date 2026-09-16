import Image from "next/image";
import { GlowField } from "./GlowField";
import { HeroPreview } from "./HeroPreview";
import { MetalButton } from "./MetalButton";
import { BLOG_URL, DOWNLOAD_URL } from "@/lib/site";

/*
 * Geometry note: the visible squircle is inset ~9.8% inside the 1024px PNG
 * (compose-icon.swift uses inset 100), with a corner radius of ~22.4% of the
 * squircle's own side (radius ratio 0.2237). The sheen overlay has to match
 * both numbers, otherwise you get a visible second, mismatched squircle.
 */
const PLATE_INSET = "9.8%";
const PLATE_RADIUS = "22.4%";

function IconPlate() {
  return (
    /*
     * Pulled left by its own padding. The PNG carries PLATE_INSET of
     * transparent margin on every side, so left to sit at the column's edge
     * the squircle lands that far inboard and reads as indented against the
     * headline under it. The width goes through a variable because the offset
     * has to be a fraction of the icon's own width — a percentage margin would
     * resolve against the column instead.
     */
    <div
      className="relative w-[var(--icon-w)] [--icon-w:6rem] sm:[--icon-w:7rem]"
      style={{
        marginLeft: `calc(var(--icon-w) * -${parseFloat(PLATE_INSET) / 100})`,
      }}
    >
      <div className="relative">
        <Image
          src="/agentspend-icon.png"
          alt="AgentSpend app icon: three overlapping lightning bolts in teal, blue and orange"
          width={1024}
          height={1024}
          priority
          sizes="(min-width: 640px) 112px, 96px"
          className="w-full"
          // drop-shadow follows the PNG's alpha, so the glow hugs the squircle
          // rather than a bounding box. That is what reads as a lit object.
          style={{
            filter:
              "drop-shadow(0 18px 50px rgba(4,170,130,0.38)) drop-shadow(0 10px 70px rgba(25,66,205,0.34)) drop-shadow(0 24px 60px rgba(243,55,0,0.30))",
          }}
        />

        {/* Specular highlight and rim light: the whole "glass" read. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute mix-blend-overlay ring-1 ring-inset ring-white/25"
          style={{
            inset: PLATE_INSET,
            borderRadius: PLATE_RADIUS,
            backgroundImage:
              "linear-gradient(158deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 34%, transparent 52%)",
          }}
        />
      </div>

      {/* Floor reflection. Sells the icon as sitting on glass. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-full opacity-[0.18] blur-[2px]"
        style={{
          // Both the icon and its mirror carry PLATE_INSET of transparent
          // padding, so without pulling back by twice that the reflection
          // floats detached below the squircle.
          marginTop: `-${parseFloat(PLATE_INSET) * 2}%`,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 55%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, transparent 55%)",
        }}
      >
        <Image
          src="/agentspend-icon.png"
          alt=""
          width={1024}
          height={1024}
          sizes="(min-width: 640px) 112px, 96px"
          className="w-full -scale-y-100"
        />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Pooled over the pitch, which is where the eye starts now that the
       * copy has flushed left and the product holds the right. */}
      <GlowField className="lg:[--glow-x:28%]" />

      {/* Two columns from lg: the pitch, and the thing itself. */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pt-20 pb-24 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
        <div>
          <IconPlate />

          {/* Just clears the floor reflection, which runs to a little under
           * half the icon's height below it before the mask takes it to
           * nothing. Any more than that and the icon reads as detached from
           * the sentence it belongs to. */}
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:mt-8 sm:text-5xl md:text-6xl">
            Understand your AgentSpend
          </h1>

          <p className="mt-6 max-w-xl text-lg/8 text-pretty text-muted">
            AgentSpend sits in your menu bar and shows what your Claude Code usage
            costs in dollars. Plus, an estimate of the energy in kWh behind the
            usage. It updates while you work and proactively teaches you habits to
            reduce your spend.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href={BLOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-base font-medium text-ink transition-colors duration-300 ease-out hover:border-white/35 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:w-auto"
            >
              Read the write-up
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                className="size-3.5 opacity-60"
              >
                <path
                  d="M6 2h8v8M14 2 3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <MetalButton className="w-full sm:w-auto" alwaysOn>
              <a
                href={DOWNLOAD_URL}
                /* `text-center` for the phone, where the button goes full
                 * width: the pitch around it is flush left now, so the label
                 * no longer inherits any centring. */
                className="w-full rounded-full px-7 py-3.5 text-center text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:w-auto"
              >
                Download for macOS
              </a>
            </MetalButton>
          </div>

          <p className="mt-6 text-sm text-muted">Free and MIT licensed.</p>
        </div>

        {/* Only where there is a column for it. Stacked under the pitch it
         * added 540pt of hero above the fold, which pushed the section that
         * explains the window off screen — and the showcase covers the panes a
         * couple of screens down regardless. */}
        <HeroPreview className="hidden lg:block" />
      </div>
    </section>
  );
}
