"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { C, fadeMask, Rule } from "./screens/chrome";

/*
 * The segmented picker in the hero window, wired up. The app's three panes are
 * already built as markup for the showcase, so the figure can show all three
 * rather than a still of one, and the picker stops being a drawing of a control
 * that does nothing.
 *
 * The panes arrive as props rather than being imported here. This file is the
 * client boundary, so anything it imports ships to the browser; handed down as
 * ReactNode from the server component above, the three panes render on the
 * server and only the ~1kB of state and key handling below crosses over.
 */

export type Pane = {
  key: string;
  label: string;
  node: ReactNode;
  /** What this pane shows, for the single described graphic it becomes. */
  alt: string;
};

/* The pane is taller than the scroll view, so the crop has to say so. Held
 * close to the bottom edge, unlike the showcase tiles: there the fade is the
 * end of the card, here it is a scroll view inside a window that continues. */
const CONTENT_FADE = fadeMask(
  "linear-gradient(to bottom, #000 0%, #000 84%, rgb(0 0 0 / 0.5) 94%, transparent 100%)",
);

/*
 * AppKit's segmented control in dark mode: a sunken track with the selected
 * segment raised out of it. Eyeballed rather than sampled — the renderer
 * captures panes, not the chrome around them — so it is the one part of this
 * figure that approximates the app instead of matching it.
 */
const SELECTED = {
  background: "#4c4c4c",
  color: "#ffffff",
  boxShadow:
    "inset 0 1px 0 0 rgb(255 255 255 / 0.10), 0 1px 2px 0 rgb(0 0 0 / 0.35)",
} as const;

export function PreviewTabs({
  panes,
  contentHeight,
}: {
  panes: Pane[];
  /** The scroll view's height, which the fade has to match exactly. */
  contentHeight: number;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const tabId = (i: number) => `${id}-tab-${panes[i].key}`;
  const panelId = `${id}-panel`;

  /*
   * Arrow keys move between tabs, which is what a tablist is expected to do:
   * only the selected tab is in the tab order (`tabIndex` below), so without
   * this the other two panes are unreachable from the keyboard.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = panes.length - 1;
    const next = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    }[event.key];

    if (next === undefined) return;

    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <div className="p-[10px]">
        <div
          role="tablist"
          aria-label="AgentSpend window"
          onKeyDown={onKeyDown}
          className="flex h-[22px] items-stretch gap-[1px] rounded-[7px] p-[1px]"
          style={{ background: "#2c2c2c" }}
        >
          {panes.map((pane, i) => (
            <button
              key={pane.key}
              ref={(node) => {
                tabs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={i === active}
              aria-controls={panelId}
              /* Roving tabindex: the tablist is one stop in the page's tab
               * order, and the arrow keys move within it. */
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className="flex flex-1 cursor-pointer items-center justify-center rounded-[6px] text-[12px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
              style={i === active ? SELECTED : { color: C.primary }}
            >
              {pane.label}
            </button>
          ))}
        </div>
      </div>

      {/* One of the window's two dividers, both of which CONTENT_H subtracts. */}
      <Rule />

      {/* Definite height, so the fade spans the visible pane — see fadeMask.
       * The pane inside is left at its natural height: `Screen` is a column
       * flex container, so a definite height would let the overflowing rows
       * shrink to fit instead of running out of frame under the fade. */}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(active)}
        className="relative overflow-hidden"
        style={{ height: contentHeight, ...CONTENT_FADE }}
      >
        {/* Announced as one described graphic, and not given a tab stop of its
         * own: the markup underneath is a wall of demo figures, and the crop
         * does not scroll, so there is nothing in here to operate. */}
        <div
          role="img"
          aria-label={panes[active].alt}
          className="absolute inset-x-0 top-0"
        >
          {panes[active].node}
        </div>
      </div>
    </>
  );
}
