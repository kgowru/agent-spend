"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/site";
import { HERO_CTA_ID } from "./anchors";
import { MetalButton } from "./MetalButton";

/*
 * The header is not there when you arrive. It floats in once the hero's
 * Download button is behind you, and goes away again if you scroll back up to
 * it. While a visitor is still reading the pitch, the only thing the bar could
 * offer them is the button already sitting under the paragraph, so the hero
 * gets the top of the screen to itself.
 *
 * It is always mounted and always out of flow, and only its opacity, transform
 * and visibility change, so nothing below it can move when it arrives. See the
 * note on the element for why `fixed` rather than `sticky`.
 *
 * The external store is the page itself, and there is one header and one hero
 * on it, so the flag lives out here beside its subscribe.
 */
let ctaAhead = true;

function subscribe(onStoreChange: () => void) {
  const cta = document.getElementById(HERO_CTA_ID);

  /* No hero to defer to, so nothing to stay out of the way of: the header shows
   * and stays. React re-reads the snapshot once this returns, so there is
   * nothing to notify. */
  if (!cta) {
    ctaAhead = false;
    return () => {};
  }

  const observer = new IntersectionObserver(([entry]) => {
    ctaAhead = entry.isIntersecting;
    onStoreChange();
  });

  observer.observe(cta);
  return () => observer.disconnect();
}

const getSnapshot = () => ctaAhead;

/* Hidden on the server, which is also the state the first client render sees,
 * so the header never flashes over the hero before the observer reports in. */
const getServerSnapshot = () => true;

export function Nav() {
  const hidden = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <header
      /*
       * A header parked above the viewport is still in the tab order, so
       * without this the first Tab on the page lands on links nobody can see.
       * `invisible` alone does not do it: metal-fx puts an inline
       * `visibility: visible` on the Download button's root, which overrides
       * the inherited `hidden` and leaves that one link focusable. `inert`
       * takes the whole subtree out of the tab order and the accessibility
       * tree regardless.
       */
      inert={hidden}
      /*
       * `fixed`, not `sticky`. Sticky keeps the header in flow, so it held 64px
       * at the top of the document even while hidden and the hero's glow began
       * below it, leaving a flat band across the top of the page. Out of flow
       * there is nothing to reserve, the hero runs to the top edge, and nothing
       * can shift when the panel appears.
       *
       * The bar spans the window and the panel inside it does not, so the
       * pointer events have to be handed back on the panel alone. Otherwise
       * this strip would swallow clicks either side of it.
       */
      className={`pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4 motion-safe:transition-[transform,opacity,visibility] motion-safe:duration-300 motion-safe:ease-out ${
        /* Drops in by its own small distance rather than sliding the full
         * height of a bar: it is a panel arriving, not a header unrolling.
         * Transitioning `visibility` as well holds it visible for the whole
         * way out, instead of blinking away at the first frame. */
        hidden
          ? "invisible -translate-y-4 opacity-0"
          : "visible translate-y-0 opacity-100"
      }`}
    >
      <nav
        aria-label="Main"
        /* Sized to its contents from sm, where there are enough links to make a
         * pill of them. On a phone only the wordmark and the button survive, and
         * a capsule holding two things marooned mid screen reads as a mistake,
         * so there it spans the width it is given. */
        className="pointer-events-auto flex w-full max-w-full items-center justify-between gap-4 rounded-full border border-white/10 bg-canvas/80 py-2 pr-2 pl-4 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:w-auto sm:gap-10"
      >
        <a
          href="#main"
          className="flex items-center gap-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-spark-teal-soft"
        >
          <Image
            src="/agentspend-icon.png"
            alt=""
            width={1024}
            height={1024}
            sizes="28px"
            className="size-7"
          />
          AgentSpend
        </a>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="#showcase"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            Features
          </a>
          <a
            href="#faq"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            FAQ
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            GitHub
          </a>
          <MetalButton>
            <a
              href={DOWNLOAD_URL}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
            >
              Download
            </a>
          </MetalButton>
        </div>
      </nav>
    </header>
  );
}
