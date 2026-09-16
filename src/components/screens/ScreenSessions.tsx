import { Fragment } from "react";
import { C, Label, NUM, Rule, Screen } from "./chrome";

/*
 * The sessions pane, rebuilt as HTML from the app's own SessionsView: every run
 * with what it cost, on which branch, with which model.
 *
 * Geometry and colour were measured off a real `AgentSpend --render` capture of
 * this pane, so this matches the app rather than approximating it. Rerun
 * tools/seed-demo-store.py and `--render` to regenerate that capture and diff
 * this against it. The figures come from the synthetic demo store
 * (tools/seed-demo-store.py), which is what the capture showed too.
 */

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
  {
    project: "design-system",
    usd: "$1.07",
    wh: "51 Wh",
    meta: ["6:57 AM", "main", "sonnet-5 +2", "14 req", "2 subagent"],
  },
];

export function ScreenSessions() {
  return (
    <Screen className="p-4">
      <div className="flex items-baseline justify-between gap-3">
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
