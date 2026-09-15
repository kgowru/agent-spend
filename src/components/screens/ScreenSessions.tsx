import { Fragment } from "react";
import { C, Label, NUM, Rule, Screen } from "./chrome";

/*
 * The sessions pane, rebuilt as HTML from the app's own SessionsView: when the
 * day's work happened, then every run with what it cost, on which branch, with
 * which model.
 *
 * Geometry and colour were measured off a real `AgentSpend --render` capture of
 * this pane, so this matches the app rather than approximating it: the bar
 * heights below are the render's own bar heights read back in pixels. Rerun
 * tools/seed-demo-store.py and `--render` to regenerate that capture and diff
 * this against it. The figures come from the synthetic demo store
 * (tools/seed-demo-store.py), which is what the capture showed too.
 */

/**
 * Cost in each hour of the day as a fraction of the busiest hour, 00 through
 * 23. The app draws `34 * usd / max` points, so these fractions are the shape
 * of the day itself, not a stylisation of it.
 *
 * The capture's busy hours are 05 through 08 and 11 through 14: its 24 columns
 * span the pane exactly, so column 0 is hour 0 and the peak sits under the
 * axis centre. Hour 08 earned so little that the app clamped it to the 2pt
 * floor, which is why it reads as a bright stub rather than a bar.
 */
const HOURS = [
  0, 0, 0, 0, 0, 0.15, 0.35, 0.19, 0.05, 0, 0, 0.24, 0.89, 1, 0.15, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
];

/** Height of the bar area. Fixed, so the chart keeps its proportions as the
 *  tile widens instead of growing into a banner. */
const CHART_PX = 46;

/** An hour with no spend still gets a stub, which is what gives the chart a
 *  baseline to read the busy hours against. Matches the app's 2pt floor. */
const STUB_PX = 2;

/** The tint at the 12% the app draws an empty hour with, flattened against the
 *  pane so a stub stays one flat colour. */
const EMPTY_BAR = "#1a2c39";

type Session = {
  project: string;
  usd: string;
  wh: string;
  /** Time, branch, models, requests, subagents. Joined by a middot. */
  meta: string[];
};

const SESSIONS: Session[] = [
  {
    project: "api-gateway",
    usd: "$1.56",
    wh: "75 Wh",
    meta: ["2:22 PM", "feat/rate-limits", "opus-4-8 +2", "28 req", "1 subagent"],
  },
  {
    project: "api-gateway",
    usd: "$2.20",
    wh: "104 Wh",
    meta: ["1:48 PM", "feat/rate-limits", "opus-4-8 +2", "42 req", "1 subagent"],
  },
  {
    project: "api-gateway",
    usd: "$2.17",
    wh: "105 Wh",
    meta: ["12:59 PM", "feat/rate-limits", "opus-4-8 +2", "35 req", "5 subagent"],
  },
  {
    project: "api-gateway",
    usd: "$0.85",
    wh: "39 Wh",
    meta: ["8:11 AM", "feat/rate-limits", "opus-4-8 +2", "20 req", "2 subagent"],
  },
];

export function ScreenSessions() {
  return (
    <Screen className="p-4">
      <Label>By hour</Label>

      {/* Decorative: the hours it stands for are named by the axis under it,
       *  and every session below carries its own time. */}
      <div
        aria-hidden="true"
        className="mt-1 flex shrink-0 items-end gap-px"
        style={{ height: CHART_PX }}
      >
        {HOURS.map((fraction, hour) => (
          <div
            key={hour}
            className="min-w-0 flex-1 rounded-[1px]"
            style={{
              height: Math.max(STUB_PX, Math.round(fraction * CHART_PX)),
              background: fraction > 0 ? C.blue : EMPTY_BAR,
            }}
          />
        ))}
      </div>

      {/* Tabular figures keep "00" and "23" the same width, which is what puts
       *  "12" on the chart's centre line. */}
      <div
        className="mt-1 flex justify-between text-[11px]"
        style={{ color: C.tertiary, ...NUM }}
      >
        <span>00</span>
        <span>12</span>
        <span>23</span>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <Label>Sessions, most recent first</Label>
        <span
          className="shrink-0 text-[11px]"
          style={{ color: C.tertiary, ...NUM }}
        >
          median context 34.2k
        </span>
      </div>

      {SESSIONS.map((session, i) => (
        <Fragment key={`${session.project}-${session.meta[0]}`}>
          {i > 0 && <Rule className="shrink-0" />}
          <div className="flex flex-col gap-[3px] py-[9px]">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                {session.project}
              </span>
              <span className="text-[12px]" style={NUM}>
                {session.usd}
              </span>
              {/* The app's fixed 62pt energy column, so Wh stays a column
               *  rather than drifting with the cost beside it. */}
              <span
                className="w-[62px] shrink-0 text-right text-[12px]"
                style={{ color: C.secondary, ...NUM }}
              >
                {session.wh}
              </span>
            </div>
            <div
              className="truncate text-[11px]"
              style={{ color: C.secondary, ...NUM }}
            >
              {session.meta.join(" · ")}
            </div>
          </div>
        </Fragment>
      ))}
    </Screen>
  );
}
