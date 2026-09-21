import { Fragment } from "react";
import { C, Label, NUM, Rule, Screen } from "./chrome";
import { tokens, usd, wh } from "./format";
import { HourlyBars, type Hour } from "./HourlyBars";
import { SegmentedControl } from "./SegmentedControl";

/*
 * The sessions pane, rebuilt as HTML from the app's own SessionsView: the scope
 * picker, when today's work happened, then every run with what it cost, on
 * which branch, with which model.
 *
 * Geometry and colour were measured off a real `AgentSpend --render` capture of
 * this pane, so this matches the app rather than approximating it. Rerun
 * tools/seed-demo-store.py and `--render` to regenerate that capture and diff
 * this against it. The figures come from the synthetic demo store
 * (tools/seed-demo-store.py), which is what the capture showed too.
 *
 * Presentational: scope and hover are props, so a showcase tile renders this on
 * the server as a still and the hero renders it through ScreenSessionsLive.
 */

export const SCOPES = ["Today", "3 days", "7 days"] as const;
export type Scope = (typeof SCOPES)[number];

/** How far back each scope reaches, in days. */
const SCOPE_DAYS: Record<Scope, number> = { Today: 1, "3 days": 3, "7 days": 7 };

/** The app asks the store for fifteen, which is what a 7 day window fills. */
const LIMIT = 15;

type Session = {
  /** Days before today, matching `history.ts`. */
  back: number;
  project: string;
  usd: number;
  wh: number;
  /** Start of the meta line, and the hour the run lands in on the chart. */
  time: string;
  branch: string;
  /** Already shortened the way the app shortens it: "opus-4-8 +2". */
  model: string;
  reqs: number;
  subagents: number;
  /** Average context, which is what the median under the heading is taken of. */
  context: number;
};

/** Most recent first, which is the order the pane lists them in. */
const SESSIONS: Session[] = [
  { back: 0, project: "api-gateway", usd: 1.56, wh: 75, time: "2:22 PM", branch: "feat/rate-limits", model: "opus-4-8 +2", reqs: 28, subagents: 1, context: 34_200 },
  { back: 0, project: "api-gateway", usd: 2.2, wh: 104, time: "1:48 PM", branch: "feat/rate-limits", model: "opus-4-8 +2", reqs: 42, subagents: 1, context: 62_300 },
  { back: 0, project: "api-gateway", usd: 2.17, wh: 105, time: "12:59 PM", branch: "feat/rate-limits", model: "opus-4-8 +2", reqs: 35, subagents: 5, context: 47_600 },
  { back: 0, project: "api-gateway", usd: 0.85, wh: 39, time: "8:11 AM", branch: "feat/rate-limits", model: "opus-4-8 +2", reqs: 20, subagents: 2, context: 21_400 },
  { back: 0, project: "design-system", usd: 1.07, wh: 51, time: "6:57 AM", branch: "main", model: "sonnet-5 +2", reqs: 14, subagents: 2, context: 28_900 },

  { back: 1, project: "storefront", usd: 0.94, wh: 44, time: "5:40 PM", branch: "fix/cart-totals", model: "sonnet-5", reqs: 17, subagents: 0, context: 52_400 },
  { back: 1, project: "api-gateway", usd: 3.41, wh: 163, time: "3:05 PM", branch: "feat/rate-limits", model: "opus-4-8 +1", reqs: 58, subagents: 3, context: 186_000 },
  { back: 1, project: "storefront", usd: 0.62, wh: 29, time: "11:26 AM", branch: "fix/cart-totals", model: "haiku-4-5", reqs: 11, subagents: 0, context: 18_700 },

  { back: 2, project: "design-system", usd: 2.83, wh: 136, time: "6:18 PM", branch: "main", model: "opus-4-8 +2", reqs: 47, subagents: 4, context: 74_500 },
  { back: 2, project: "docs-site", usd: 0.41, wh: 19, time: "9:52 AM", branch: "docs/method", model: "haiku-4-5", reqs: 9, subagents: 0, context: 11_200 },

  { back: 3, project: "api-gateway", usd: 4.12, wh: 197, time: "4:33 PM", branch: "feat/rate-limits", model: "opus-4-8 +2", reqs: 66, subagents: 6, context: 98_100 },
  { back: 3, project: "storefront", usd: 1.19, wh: 56, time: "10:07 AM", branch: "main", model: "sonnet-5 +1", reqs: 22, subagents: 1, context: 40_300 },

  { back: 4, project: "design-system", usd: 0.78, wh: 36, time: "2:49 PM", branch: "feat/tokens", model: "sonnet-5", reqs: 15, subagents: 0, context: 26_500 },
  { back: 5, project: "api-gateway", usd: 2.64, wh: 126, time: "7:31 PM", branch: "main", model: "opus-4-8 +1", reqs: 44, subagents: 2, context: 81_900 },
  { back: 6, project: "docs-site", usd: 0.53, wh: 25, time: "1:14 PM", branch: "docs/method", model: "haiku-4-5 +1", reqs: 12, subagents: 0, context: 15_200 },
];

/** "2:22 PM" as the hour of the day the chart puts it in. */
function hourOf(time: string): number {
  const [clock, meridiem] = time.split(" ");
  return (Number(clock.split(":")[0]) % 12) + (meridiem === "PM" ? 12 : 0);
}

/*
 * When the day's work happened, summed off the rows below rather than declared
 * beside them, so the chart cannot drift from the list it summarises. The app
 * only draws this at the Today scope: three days of runs flattened onto one 24
 * hour axis would be three days pretending to be one.
 */
function hoursToday(sessions: Session[]): Hour[] {
  const hours: Hour[] = Array.from({ length: 24 }, () => ({ usd: 0, reqs: 0 }));
  for (const session of sessions) {
    const hour = hours[hourOf(session.time)];
    hour.usd += session.usd;
    hour.reqs += session.reqs;
  }
  return hours;
}

/**
 * What the figures under the picker are showing, for a screen reader.
 *
 * Derived from the scope rather than handed in: only Today draws the hourly
 * chart, so a description written once upstream would promise a chart the
 * wider windows do not have.
 */
function describe(scope: Scope): string {
  return scope === "Today"
    ? "A chart of when today's work happened, then each run with its project, branch, model, request count and cost."
    : `Every run of the last ${SCOPE_DAYS[scope]} days, with its project, branch, model, request count and cost.`;
}

export function ScreenSessions({
  scope = "Today",
  onScope,
  hovered = null,
  onHover,
}: {
  scope?: Scope;
  /** Wired up only in the hero, where the whole pane is under the picker. */
  onScope?: (scope: Scope) => void;
  /** The hour the pointer is on, 0–23. */
  hovered?: number | null;
  onHover?: (hour: number | null) => void;
}) {
  const sessions = SESSIONS.filter((s) => s.back < SCOPE_DAYS[scope]).slice(0, LIMIT);

  /* Long context is flagged against this user's own baseline. An absolute
   * threshold fired on nearly every row, which makes it decoration. */
  const contexts = sessions.map((s) => s.context).sort((a, b) => a - b);
  const median = contexts[Math.floor(contexts.length / 2)];
  const longThreshold = Math.max(150_000, median * 1.8);

  const figure = (
    <>
      {scope === "Today" && (
        <HourlyBars
          hours={hoursToday(sessions)}
          hovered={hovered}
          onHover={onHover}
        />
      )}

      <div className="flex items-baseline justify-between gap-3">
        <Label>Sessions, most recent first</Label>
        <span className="shrink-0 text-[11px]" style={{ color: C.tertiary, ...NUM }}>
          median context {tokens(median)}
        </span>
      </div>

      {sessions.map((session, i) => (
        <Fragment key={`${session.back}-${session.time}`}>
          {i > 0 && <Rule className="shrink-0" />}
          <div className="flex flex-col gap-[3px] py-[9px]">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                {session.project}
              </span>
              <span className="text-[12px]" style={NUM}>
                {usd(session.usd)}
              </span>
              {/* The app's fixed 62pt energy column, so Wh stays a column
               *  rather than drifting with the cost beside it. */}
              <span
                className="w-[62px] shrink-0 text-right text-[12px]"
                style={{ color: C.secondary, ...NUM }}
              >
                {wh(session.wh)}
              </span>
            </div>
            <div className="truncate text-[11px]" style={{ color: C.secondary, ...NUM }}>
              {meta(session).join(" · ")}
            </div>
            {/* Long context is where cost runs away superlinearly, so outliers
             * are worth calling out on the row rather than leaving to
             * inference. */}
            {session.context > longThreshold && (
              <div className="truncate text-[11px]" style={{ color: C.orange, ...NUM }}>
                avg context {tokens(session.context)} — well above your median
              </div>
            )}
          </div>
        </Fragment>
      ))}
    </>
  );

  /* A still, described by whatever frames it. The showcase tile wraps the
   * whole pane in one `img`, and there is nothing in here to operate. */
  if (!onScope) return <Screen className="p-4">{figure}</Screen>;

  return (
    <Screen className="p-4">
      {/* Scope, then the shape of the day, then the runs themselves. */}
      <SegmentedControl
        options={SCOPES}
        selected={scope}
        onSelect={onScope}
        label="Window"
      />
      <div className="h-[14px] shrink-0" />

      {/* The pane describes its own figures because it also carries a control,
       * and anything inside an `img` is not exposed: wrapping the lot would put
       * the picker out of reach of a screen reader. */}
      <div role="img" aria-label={describe(scope)} className="flex min-w-0 flex-col">
        {figure}
      </div>
    </Screen>
  );
}

/** Time, branch, model, requests, subagents. Joined by a middot. */
function meta(session: Session): string[] {
  const line = [session.time, session.branch, session.model, `${session.reqs} req`];
  if (session.subagents > 0) line.push(`${session.subagents} subagent`);
  return line;
}
