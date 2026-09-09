"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { MetalFx } from "metal-fx";

/*
 * The primary call to action: a white outline button at rest, with the liquid
 * metal shimmer easing in under the cursor.
 *
 * The shimmer is driven by MetalFx's `strength` prop rather than a CSS opacity
 * on the canvas, because `strength` scales the shader bitmap and the glow alpha
 * together. Fading the canvas element alone would wash the two layers out at
 * different rates and the halo would visibly outlive the ring.
 *
 * While `strength` is 0 the instance is also `paused`, so an idle page runs no
 * WebGL frames at all. Three always-on instances is what made the first pass
 * feel sluggish.
 */

/* Arriving should feel responsive; leaving should read as metal cooling rather
 * than a light being switched off. */
const FADE_IN_MS = 260;
const FADE_OUT_MS = 460;

/* Resting opacity of the outline, and how much of it the shimmer takes away —
 * the ring hands off to the metal instead of the two stacking up. */
const EDGE_REST = 0.85;
const EDGE_HANDOFF = 0.7;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** True only once the client has hydrated. `useSyncExternalStore` is the
 *  React-sanctioned way to read this: it uses `getServerSnapshot` for the
 *  hydration render (matching the server) and `getClientSnapshot` after,
 *  without the extra render pass `useEffect` + `setState` would need. */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Eases `strength` toward a target on pointer/focus, on a rAF clock.
 *
 * Animating from the event handlers rather than from an effect keeps the
 * render pass free of the cascading setState an effect-driven tween needs, and
 * hover is an event to begin with.
 */
function useShimmer() {
  const [strength, setStrength] = useState(0);
  const current = useRef(0);
  const frame = useRef<number | null>(null);

  const animateTo = useCallback((target: number, duration: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    const from = current.current;
    if (from === target) return;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = from + (target - from) * easeOutCubic(t);

      current.current = value;
      setStrength(value);

      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };

    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const show = useCallback(() => animateTo(1, FADE_IN_MS), [animateTo]);
  const hide = useCallback(() => animateTo(0, FADE_OUT_MS), [animateTo]);

  return { strength, show, hide };
}

export function MetalButton({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const isClient = useIsClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { strength, show, hide } = useShimmer();

  /* A wandering shader under the cursor is exactly what this asks to opt out
   * of, so reduced motion keeps the plain outline button. */
  const shimmer = isClient && !prefersReducedMotion;

  return (
    <span
      /* The outline lives out here rather than on the child: MetalFx normalizes
       * the wrapped element's border, background and shadow away so consumer
       * styles can't fight its ring. Keeping the shell mounted on the server
       * too means hydration doesn't shift the button's geometry. */
      className={`btn-metal relative inline-flex rounded-full border transition-colors duration-300 ease-out hover:bg-white/5 ${className}`}
      style={{
        borderColor: `rgb(233 239 236 / ${EDGE_REST - EDGE_HANDOFF * strength})`,
      }}
      onPointerEnter={shimmer ? show : undefined}
      onPointerLeave={shimmer ? hide : undefined}
      onFocus={shimmer ? show : undefined}
      onBlur={shimmer ? hide : undefined}
    >
      {shimmer ? (
        <MetalFx
          preset="chromatic"
          /* Pinned: the site is dark regardless of the OS setting, and `auto`
           * would paint the light-mode surface for a light-mode visitor. */
          theme="dark"
          strength={strength}
          paused={strength === 0}
          className="rounded-full"
        >
          {children}
        </MetalFx>
      ) : (
        children
      )}
    </span>
  );
}
