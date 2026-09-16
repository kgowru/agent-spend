import Image from "next/image";

/*
 * The menu bar, in parts: our own status item, and stand-ins for the ones it
 * sits between.
 *
 * The neighbours are drawn rather than captured. A screenshot of a real menu
 * bar carries whatever the machine happened to be running, which is how the
 * first pass leaked private data. Generic shapes, decorative only.
 *
 * Only the hero's bar uses these now. Kept as their own module because that is
 * a separate concern from the window it hangs over, and the privacy reason for
 * drawing them has to stay attached to them.
 */

export function Cloud() {
  return (
    <svg viewBox="0 0 18 16" fill="none" className="block size-[16px]">
      <path
        d="M4.9 12.2h7.6a2.9 2.9 0 0 0 .3-5.8 4.1 4.1 0 0 0-7.8-.9 3.35 3.35 0 0 0-.1 6.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Battery() {
  return (
    <svg viewBox="0 0 27 16" fill="none" className="block h-[14px] w-[25px]">
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

export function Wifi() {
  /* The arcs top out around y 3.05 and the dot bottoms out at 14.65, so the
   * glyph's own centre is ~0.85 below the viewBox centre. Offsetting the
   * viewBox by that much centres the mark optically, rather than centring a
   * box the mark does not fill evenly. */
  return (
    <svg viewBox="0 0.85 18 16" fill="none" className="block size-[16px]">
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

export function ControlCentre() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="block size-[15px]">
      <rect x="1.4" y="2.6" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <rect x="1.4" y="8.8" width="13.2" height="4.6" rx="2.3" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
      <circle cx="10.6" cy="4.9" r="1.35" fill="currentColor" />
      <circle cx="5.4" cy="11.1" r="1.35" fill="currentColor" />
    </svg>
  );
}

/**
 * Our own status item, from a real capture of the menu bar label, sitting in
 * the selection macOS draws behind a status item while its window is open —
 * which is the only state we show it in, since the window is open below it.
 * The capture is trimmed to the glyphs, so the selection carries its own
 * padding.
 */
export function MenuBarItemShot() {
  return (
    <span className="inline-flex rounded-[5px] bg-white/15 px-[7px] py-[4px]">
      <Image
        src="/shots/shot-menubar.png"
        alt="The AgentSpend menu bar item, showing a lightning bolt and today's cost."
        width={163}
        height={47}
        /*
         * Sized off the digits, not the box. The capture is a high-scale
         * render, not a 2x screenshot of the bar: its digits are 32.5 of its
         * 47px, and the bolt and the "$" run taller still. Matching the box to
         * the 13px text beside it would therefore set the number noticeably
         * larger than everything around it, which is not how the real item
         * sits. 13px of box puts the digits at ~9px, which is the cap height
         * of 13px text.
         */
        className="h-[13px] w-auto"
        unoptimized
      />
    </span>
  );
}
