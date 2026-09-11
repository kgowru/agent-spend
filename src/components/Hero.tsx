import Image from "next/image";
import { GlowField } from "./GlowField";
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
    <div className="relative mx-auto w-36 sm:w-48 md:w-56">
      <div className="relative">
        <Image
          src="/agentspend-icon.png"
          alt="AgentSpend app icon: three overlapping lightning bolts in teal, blue and orange"
          width={1024}
          height={1024}
          priority
          sizes="(min-width: 768px) 224px, (min-width: 640px) 192px, 144px"
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
          sizes="(min-width: 768px) 224px, (min-width: 640px) 192px, 144px"
          className="w-full -scale-y-100"
        />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <GlowField />

      <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-24 text-center sm:pt-28">
        <IconPlate />

        {/* Clears the floor reflection, which is as tall as the icon. */}
        <h1 className="mt-32 text-4xl font-semibold tracking-tight text-balance sm:mt-36 sm:text-5xl md:text-6xl">
          Understand your AgentSpend
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg/8 text-pretty text-muted">
          AgentSpend sits in your menu bar and shows what your Claude Code usage
          costs in dollars. Plus, an estimate of the energy in kWh behind the
          usage. It updates while you work and proactively teaches you habits to
          reduce your spend.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <MetalButton className="w-full sm:w-auto" introOnMount>
            <a
              href={DOWNLOAD_URL}
              className="w-full rounded-full px-7 py-3.5 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:w-auto"
            >
              Download for macOS
            </a>
          </MetalButton>
        </div>

        <p className="mt-6 text-sm text-muted">Free and MIT licensed.</p>
      </div>
    </section>
  );
}
