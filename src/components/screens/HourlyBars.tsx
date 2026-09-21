import { C, Label, NUM } from "./chrome";
import { count, usd } from "./format";

/*
 * When the day's work happened, rebuilt from the app's own `HourlyBars`
 * (mac/AgentSpend/UI/SessionsView.swift). Both panes that show a single day
 * draw this: Sessions at its Today scope, and Home at 1d.
 *
 * One departure from the app, which stacks each hour by agent the way the daily
 * chart does: here an hour is one colour. At 24 bars across a 396pt pane a
 * segment is a fraction of a point wide, and the marks under a stacked version
 * would want a legend row this pane has no height for.
 *
 * Presentational, like the panes around it. Hover state is held by whichever
 * client component owns the pane, so a showcase tile can render this on the
 * server with no pointer handling at all.
 */

export type Hour = { usd: number; reqs: number };

/** The app's 34pt of bar, and its 2pt floor so a quiet hour is still an hour. */
const CHART_H = 34;
const MIN_BAR = 2;

export function HourlyBars({
  hours,
  hovered,
  onHover,
}: {
  hours: Hour[];
  /** The hour the pointer is on, 0–23. */
  hovered?: number | null;
  onHover?: (hour: number | null) => void;
}) {
  const peak = Math.max(...hours.map((h) => h.usd));
  const focus = hovered == null ? null : hours[hovered];
  const live = Boolean(onHover);

  return (
    <div className="flex shrink-0 flex-col gap-[3px] pb-[6px]">
      {/* The readout shares the label's row, so the chart neither grows nor
       * jumps when the pointer arrives. */}
      <div className="flex items-baseline justify-between gap-3">
        <Label>By hour</Label>
        {focus && focus.reqs > 0 && (
          <span className="shrink-0 truncate text-[11px]" style={NUM}>
            {String(hovered).padStart(2, "0")}:00
            <span style={{ color: C.secondary }}>
              {"  "}
              {usd(focus.usd)} · {count(focus.reqs)} req
            </span>
          </span>
        )}
      </div>

      <div
        aria-hidden="true"
        className="flex items-end gap-px"
        style={{ height: CHART_H }}
      >
        {hours.map((hour, i) => {
          // The app dims an empty hour rather than dropping it, so the day
          // reads as a day and not as a handful of floating bars.
          const empty = hour.usd === 0;
          const dimmed = hovered != null && hovered !== i;
          return (
            /* A full-height slot, not the bar itself: at 24 across, a two point
             * bar an hour tall is not something a pointer can land on. */
            <div
              key={i}
              className="flex h-full flex-1 flex-col justify-end"
              title={live ? hourTooltip(i, hour) : undefined}
              onPointerEnter={onHover && (() => onHover(i))}
              onPointerLeave={onHover && (() => onHover(null))}
            >
              <div
                className="rounded-[1px]"
                style={{
                  height: Math.max(MIN_BAR, (CHART_H * hour.usd) / peak),
                  background: C.blue,
                  opacity: empty ? 0.12 : dimmed ? 0.3 : 0.85,
                  transition: "opacity 120ms",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        className="flex items-baseline justify-between text-[11px]"
        style={{ color: C.tertiary, ...NUM }}
      >
        <span>00</span>
        <span>12</span>
        <span>23</span>
      </div>
    </div>
  );
}

function hourTooltip(hour: number, h: Hour): string {
  const clock = `${String(hour).padStart(2, "0")}:00`;
  return h.reqs === 0
    ? `${clock} — nothing ran`
    : `${clock} — ${usd(h.usd)} · ${count(h.reqs)} req`;
}
