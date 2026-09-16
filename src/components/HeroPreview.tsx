import { MenuBarClock } from "./MenuBarClock";
import {
  Battery,
  Cloud,
  ControlCentre,
  MenuBarItemShot,
  Wifi,
} from "./menu-bar";
import { C, fadeMask, NUM, Rule } from "./screens/chrome";
import { ScreenToday } from "./screens/ScreenToday";

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

/* The pane is taller than the scroll view, so the crop has to say so. Held
 * close to the bottom edge, unlike the showcase tiles: there the fade is the
 * end of the card, here it is a scroll view inside a window that continues. */
const CONTENT_FADE = fadeMask(
  "linear-gradient(to bottom, #000 0%, #000 84%, rgb(0 0 0 / 0.5) 94%, transparent 100%)",
);

const TABS = ["Home", "Sessions", "Savings"] as const;

/*
 * AppKit's segmented control in dark mode: a sunken track with the selected
 * segment raised out of it. Eyeballed rather than sampled — the renderer
 * captures panes, not the chrome around them — so it is the one part of this
 * figure that approximates the app instead of matching it.
 */
function TabBar() {
  return (
    <div className="p-[10px]">
      <div
        className="flex h-[22px] items-stretch gap-[1px] rounded-[7px] p-[1px]"
        style={{ background: "#2c2c2c" }}
      >
        {TABS.map((tab, i) => (
          <div
            key={tab}
            className="flex flex-1 items-center justify-center rounded-[6px] text-[12px]"
            style={
              i === 0
                ? {
                    background: "#4c4c4c",
                    color: "#ffffff",
                    boxShadow:
                      "inset 0 1px 0 0 rgb(255 255 255 / 0.10), 0 1px 2px 0 rgb(0 0 0 / 0.35)",
                  }
                : { color: C.primary }
            }
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  );
}

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
     * strength while the company it keeps recedes. */
    <div
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
    /* Announced as one described graphic. The markup underneath is real text,
     * but read out it is a wall of demo figures; the summary is what a listener
     * wants from an illustration. */
    <div
      role="img"
      aria-label="AgentSpend on macOS: the menu bar item showing $7.85 for today, and the window open beneath it on the Home tab, with a 14 day total of $87, a bar chart of daily cost, and a table of cost, energy and requests per day."
      className={`w-full ${className}`}
      style={{ maxWidth: WINDOW_W }}
    >
      <MenuBarSlice />

      {/* The window hangs just under the bar, as the real one does. */}
      <div
        className="mt-1.5 flex flex-col overflow-hidden rounded-xl border border-white/10"
        style={{
          height: WINDOW_H,
          background: C.surface,
          color: C.primary,
          boxShadow:
            "inset 0 1px 0 0 rgb(255 255 255 / 0.07), 0 40px 90px -30px rgb(0 0 0 / 0.9)",
        }}
      >
        <TabBar />
        <Rule />

        {/* Definite height, so the fade spans the visible pane — see fadeMask.
         * The pane inside is left at its natural height: `Screen` is a column
         * flex container, so a definite height would let the overflowing rows
         * shrink to fit instead of running out of frame under the fade. */}
        <div
          className="relative overflow-hidden"
          style={{ height: CONTENT_H, ...CONTENT_FADE }}
        >
          <div className="absolute inset-x-0 top-0">
            <ScreenToday />
          </div>
        </div>

        <Rule />
        <Footer />
      </div>
    </div>
  );
}
