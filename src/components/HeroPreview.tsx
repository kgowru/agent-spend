import { MenuBarClock } from "./MenuBarClock";
import {
  Battery,
  Cloud,
  ControlCentre,
  MenuBarItemShot,
  Wifi,
} from "./menu-bar";
import { PreviewTabs, type Pane } from "./PreviewTabs";
import { C, fadeMask, NUM, Rule } from "./screens/chrome";
import { ScreenSavings } from "./screens/ScreenSavings";
import { ScreenSessionsLive } from "./screens/ScreenSessionsLive";
import { ScreenTodayLive } from "./screens/ScreenTodayLive";

/*
 * The whole product in one figure: the menu bar item, and the window that
 * opens under it when you click it.
 *
 * Built as markup rather than shipped as a screenshot, for the same reasons as
 * the showcase panes (see Showcase.tsx): the type stays vector at any zoom, and
 * the clock in the bar keeps ticking, which is the one thing a capture of the
 * menu bar can never do.
 */

/* The window's own frame, straight from RootView: .frame(width: 420, height: 540). */
const WINDOW_W = 420;
const WINDOW_H = 540;

/* Segmented picker under 10pt of padding, then the footer row: 8pt above and
 * below a caption line. Both are the app's, and the scroll view in between
 * gets whatever the frame has left over, minus the two dividers. */
const TABS_H = 42;
const FOOTER_H = 31;
const CONTENT_H = WINDOW_H - TABS_H - FOOTER_H - 2;

/*
 * The three panes behind the picker, the same recreations the showcase uses.
 *
 * Home and Sessions arrive live: in the window they are the whole pane rather
 * than the top of one under a crop, so their own scope pickers work and their
 * charts answer the pointer, the way the app's do. Each describes its own
 * figures, per scope, which is why neither carries an `alt` here. See Pane.alt.
 *
 * Savings has nothing to operate, so it stays a still: rendered here, in a
 * server component, and handed to the client one as a node.
 */
const PANES: Pane[] = [
  {
    key: "today",
    label: "Home",
    node: <ScreenTodayLive />,
  },
  {
    key: "sessions",
    label: "Sessions",
    node: <ScreenSessionsLive />,
  },
  {
    key: "savings",
    label: "Savings",
    node: <ScreenSavings />,
    alt: "The Savings pane: up to $45 identified against $542 spent, the 26.2 kWh behind it, then ranked suggestions, each with what it is worth and the evidence behind it.",
  },
];

/* The app's footer: when it last read your logs on the left, then the metric
 * toggle, Method and Quit. */
function Footer() {
  return (
    <div
      className="flex items-center justify-between px-3 text-[11px]"
      style={{ height: FOOTER_H }}
    >
      <span style={{ color: C.secondary, ...NUM }}>updated 11:05 PM</span>
      <span className="flex items-center gap-[10px]" style={{ color: C.blue }}>
        <span className="font-medium">$</span>
        <span>Method</span>
        <span>Quit</span>
      </span>
    </div>
  );
}

/*
 * A slice of the right-hand end of the menu bar, fading out to the left where
 * the rest of the screen would continue. Our item sits where macOS puts a
 * third-party one — inboard of the system cluster — which lands it close enough
 * to the centre line of the window below for the two to read as one thing.
 */
function MenuBarSlice() {
  return (
    /* The dimming is set here and inherited: every neighbour draws in
     * `currentColor`, and our own item is an image, so it stays at full
     * strength while the company it keeps recedes.
     *
     * Described as one graphic: read out, the strip is a run of icon names and
     * a ticking clock, none of which is the point of it. */
    <div
      role="img"
      aria-label="The right-hand end of the macOS menu bar, with the AgentSpend item showing $7.85 for today among the system icons."
      className="flex h-[26px] items-center justify-end gap-3 rounded-lg border-t border-white/10 bg-white/6 px-3 text-ink/45 backdrop-blur-xl"
      style={fadeMask(
        "linear-gradient(to right, transparent, #000 22%, #000 100%)",
      )}
    >
      <Cloud />

      <MenuBarItemShot />

      {/* The cluster macOS pins to the right of everything else. It all fits
       * unconditionally: the hero only shows this column from lg, where the
       * figure is always the window's full 420. `leading-none` on the text —
       * a default line box is taller than the digits it holds, which would sit
       * the percentage off the icons' centre line. */}
      <span className="text-[13px] leading-none tracking-tight">91%</span>
      <Battery />
      <Wifi />
      <ControlCentre />
      <MenuBarClock />
    </div>
  );
}

export function HeroPreview({ className = "" }: { className?: string }) {
  return (
    /* No `role="img"` around the whole figure any more. The picker inside is a
     * real control now, and anything inside an image is not exposed as one: a
     * screen reader would read the summary and never reach the tabs. The two
     * halves are described separately instead, the bar here and the pane in
     * PreviewTabs, which is also what lets the description follow the tab. */
    <div className={`w-full ${className}`} style={{ maxWidth: WINDOW_W }}>
      <MenuBarSlice />

      {/* The window hangs just under the bar, as the real one does. */}
      <div
        className="mt-1.5 flex flex-col overflow-hidden rounded-xl border border-white/10"
        style={{
          height: WINDOW_H,
          background: C.surface,
          color: C.primary,
          /*
           * One hairline round the window, same as the cards. There used to be
           * an `inset 0 1px 0 0 rgb(255 255 255 / 0.07)` lit-top-edge here too,
           * which drew a second line immediately inside the border along the
           * top: two 1px greys stacked where the other three sides had one.
           */
          boxShadow: "0 40px 90px -30px rgb(0 0 0 / 0.9)",
        }}
      >
        <PreviewTabs panes={PANES} contentHeight={CONTENT_H} />

        <Rule />
        <Footer />
      </div>
    </div>
  );
}
