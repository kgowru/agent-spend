import { C, Headline, Label, NUM, Rule, Screen, Segmented } from "./chrome";
import { AGENTS } from "./agents";

/*
 * The home pane on its 14 day window: TodayView's `periodSection` plus the
 * `DailyBars` chart (mac/AgentSpend/UI/HistoryView.swift), rebuilt as HTML so
 * the type stays vector instead of being a capture scaled down until it goes
 * soft.
 *
 * The colours and logo paths are NOT written here. They come from `agents.ts`,
 * which tools/sync-site-agents.py generates out of the app's own
 * AgentPalette.swift and AgentLogos.swift, so the marketing screen cannot drift
 * from what the app draws.
 *
 * Every figure is invented but internally consistent: the per agent splits sum
 * to each day's total, the days sum to the $267 headline, the largest is the
 * "peak $41", and the table rows match the last five bars.
 */

const SCOPES = ["1d", "14d", "30d", "90d"] as const;

/** Per day, per agent, oldest to newest. Index matches AGENTS. */
const DAILY: number[][] = [
  [14.2, 3.1, 1.2, 0.0],
  [26.4, 6.8, 2.4, 1.1],
  [12.9, 2.2, 0.0, 0.6],
  [24.1, 7.4, 3.0, 1.3],
  [1.2, 0.0, 0.4, 0.0],
  [2.4, 0.6, 0.0, 0.0],
  [13.8, 4.1, 1.9, 0.8],
  [10.2, 2.8, 0.0, 0.5],
  [18.6, 5.2, 2.1, 1.0],
  [30.4, 7.9, 2.6, 0.0],
  [15.1, 3.4, 1.1, 0.7],
  [4.3, 1.1, 0.0, 0.0],
  [2.1, 0.5, 0.3, 0.0],
  [17.9, 4.6, 1.8, 0.9],
];

const DAY_TOTAL = DAILY.map((d) => d.reduce((a, b) => a + b, 0));
const PEAK = Math.max(...DAY_TOTAL);

/** Chart height in px. The app draws 54pt of bar; this is that at our scale. */
const CHART_H = 70;
/** The app floors a bar at 2pt so a quiet day still reads as a day, not a gap. */
const MIN_BAR = 2;

/** The agent's mark at legend size: its logo, or its initial where none exists. */
function Mark({ i, size = 10 }: { i: number; size?: number }) {
  const a = AGENTS[i];
  if (!a.path) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center font-bold"
        style={{ width: size, height: size, fontSize: size * 0.8, color: a.color }}
      >
        {a.label[0]}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={a.path} fill={a.color} />
    </svg>
  );
}

type Row = { day: string; project: string; cost: string; energy: string; reqs: string };

const ROWS: Row[] = [
  { day: "Today", project: "api-gateway", cost: "$25.20", energy: "1.1 kWh", reqs: "412" },
  { day: "Yesterday", project: "storefront", cost: "$2.90", energy: "128 Wh", reqs: "47" },
  { day: "Sat, Sep 12", project: "api-gateway", cost: "$5.40", energy: "241 Wh", reqs: "88" },
  { day: "Fri, Sep 11", project: "api-gateway", cost: "$20.30", energy: "902 Wh", reqs: "331" },
  { day: "Thu, Sep 10", project: "storefront", cost: "$40.90", energy: "1.8 kWh", reqs: "664" },
];

const COST_W = "w-[56px] sm:w-[70px]";
const ENERGY_W = "w-[60px] sm:w-[76px]";
const REQS_W = "w-[38px] sm:w-[48px]";

export function ScreenToday() {
  return (
    <Screen className="gap-4 p-4">
      {/* 1d is where it opens, every time: the question a glance at the menu
       * bar asks is "what am I spending right now". */}
      <Segmented options={SCOPES} selected="14d" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-px">
          <Label>Last 14 days</Label>
          <Headline>$267</Headline>
          {/* Energy is Anthropic-only, and the app says so rather than
           * presenting a partial total as the whole. */}
          <Label>7.8 kWh (Claude Code only) · 2,418 requests</Label>
          <Label tone={C.tertiary}>≈ 6.4 hours of a typical US home</Label>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-px text-right">
          <Label>Today</Label>
          <Headline>$25.20</Headline>
          <Label tone={C.tertiary}>1.3× the 14d avg</Label>
        </div>
      </div>

      {/* What the number actually is. On a flat rate plan it is a list price
       * equivalent, and the gap is large enough that leaving it unsaid is the
       * biggest overstatement the app could make. */}
      <Label tone={C.tertiary} className="leading-snug">
        List price, not your bill. You are on Claude Max 5x, which is flat rate.
      </Label>

      <div className="flex flex-col gap-1">
        <div
          aria-hidden="true"
          className="flex items-end gap-[3px]"
          style={{ height: CHART_H }}
        >
          {DAILY.map((day, i) => {
            const total = DAY_TOTAL[i];
            const h = Math.max(MIN_BAR, (CHART_H * total) / PEAK);
            return (
              <div
                key={i}
                className="flex flex-1 flex-col justify-end overflow-hidden rounded-t-[2px]"
                style={{ height: h }}
              >
                {/* Top down, so the rounded cap lands on the topmost segment.
                 * Palette order, never that day's ranking: a stack that
                 * re-sorted would put a different agent at the same height on
                 * neighbouring bars, which is the comparison the eye makes. */}
                {day
                  .map((usd, a) => ({ usd, a }))
                  .filter((s) => s.usd > 0)
                  .reverse()
                  .map(({ usd, a }) => (
                    <div
                      key={a}
                      style={{
                        height: `${(usd / total) * 100}%`,
                        background: AGENTS[a].color,
                      }}
                    />
                  ))}
              </div>
            );
          })}
        </div>

        <div className="flex items-baseline justify-between">
          <Label tone={C.tertiary}>Sep 1</Label>
          <Label tone={C.tertiary} className="tabular-nums">
            peak $41
          </Label>
        </div>

        {/* Identity is never colour alone: the legend is always present, and in
         * the app hovering a bar swaps it for that day's per agent split. */}
        <div className="mt-[2px] flex flex-wrap items-center gap-x-3 gap-y-1">
          {AGENTS.map((a, i) => (
            <span key={a.key} className="inline-flex items-center gap-[4px]">
              <Mark i={i} />
              <Label>{a.label}</Label>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[5px]">
        <div
          className="flex items-baseline gap-[10px] text-[11px]"
          style={{ color: C.secondary }}
        >
          <span className="min-w-0 flex-1">day</span>
          <span className={`${COST_W} text-right`}>cost</span>
          <span className={`${ENERGY_W} text-right`}>energy</span>
          <span className={`${REQS_W} text-right`}>reqs</span>
        </div>

        <Rule />

        {ROWS.map((row) => (
          <div
            key={row.day}
            className="flex items-center gap-[10px] text-[12px] leading-[1.35]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate">{row.day}</div>
              <div className="truncate text-[11px]" style={{ color: C.tertiary }}>
                {row.project}
              </div>
            </div>
            <span className={`${COST_W} text-right`} style={NUM}>
              {row.cost}
            </span>
            <span
              className={`${ENERGY_W} text-right`}
              style={{ ...NUM, color: C.secondary }}
            >
              {row.energy}
            </span>
            <span
              className={`${REQS_W} text-right`}
              style={{ ...NUM, color: C.secondary }}
            >
              {row.reqs}
            </span>
          </div>
        ))}
      </div>
    </Screen>
  );
}
