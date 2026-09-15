import { C, Headline, Label, NUM, Rule, Screen } from "./chrome";

/*
 * The home pane on its 14 day window: TodayView's `periodSection` plus the
 * `DailyBars` chart (mac/AgentSpend/UI/HistoryView.swift), rebuilt as HTML so
 * the type stays vector instead of being a capture scaled down until it goes
 * soft.
 *
 * Every figure here is read off the real render of the pane, which was drawn
 * from the synthetic demo store (tools/seed-demo-store.py). The per day costs
 * below reconstruct that store: they sum to the $87 headline, the largest is
 * the "peak $14", the last five match the table rows, and today over their
 * average is the 1.3x the pane reports.
 */

/** Daily cost, oldest (Sep 1) to newest (today). */
const DAILY_USD = [
  6.4, 14.4, 6.54, 13.94, 0.53, 0.81, 5.86, 4.67, 8.4, 9.26, 6.09, 1.81, 0.87,
  7.85,
];

const PEAK = Math.max(...DAILY_USD);

/** Chart height in px. The app draws 54pt of bar; this is that at our scale. */
const CHART_H = 70;

/** The app floors a bar at 2pt so a quiet day still reads as a day, not a gap. */
const MIN_BAR = 2;

type Row = {
  day: string;
  project: string;
  cost: string;
  energy: string;
  reqs: string;
};

/** Newest first, as the app lists them: the recent days are the actionable ones. */
const ROWS: Row[] = [
  { day: "Today", project: "api-gateway", cost: "$7.85", energy: "375 Wh", reqs: "139" },
  { day: "Yesterday", project: "storefront", cost: "$0.87", energy: "42 Wh", reqs: "12" },
  { day: "Sat, Sep 12", project: "api-gateway", cost: "$1.81", energy: "86 Wh", reqs: "28" },
  { day: "Fri, Sep 11", project: "api-gateway", cost: "$6.09", energy: "291 Wh", reqs: "109" },
  { day: "Thu, Sep 10", project: "storefront", cost: "$9.26", energy: "445 Wh", reqs: "158" },
];

/* The app's fixed column frames (58 / 64 / 40pt), so the numbers stack into
 * columns whatever width the tile happens to be. */
const COST_W = "w-[56px] sm:w-[70px]";
const ENERGY_W = "w-[60px] sm:w-[76px]";
const REQS_W = "w-[38px] sm:w-[48px]";

export function ScreenToday() {
  return (
    <Screen className="gap-4 p-4">
      {/* Period total on the left, today on the right, both label over figure. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-px">
          <Label>Last 14 days</Label>
          <Headline>$87</Headline>
          <Label>4.2 kWh · 1,498 requests</Label>
          <Label tone={C.tertiary}>≈ 3.5 hours of a typical US home</Label>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-px text-right">
          <Label>Today</Label>
          <Headline>$7.85</Headline>
          {/* Tertiary while today is close to the window's average; the app
           * only turns this orange past 1.5x. */}
          <Label tone={C.tertiary}>1.3× the 14d avg</Label>
        </div>
      </div>

      {/* Daily cost. Today is tinted so it reads against the rest at a glance. */}
      <div className="flex flex-col gap-1">
        <Label tone={C.tertiary}>Hover a bar for that day</Label>

        <div
          aria-hidden="true"
          className="flex items-end gap-[3px]"
          style={{ height: CHART_H }}
        >
          {DAILY_USD.map((usd, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: Math.max(MIN_BAR, (CHART_H * usd) / PEAK),
                background: i === DAILY_USD.length - 1 ? C.orange : C.blue,
              }}
            />
          ))}
        </div>

        <div className="flex items-baseline justify-between">
          <Label tone={C.tertiary}>Sep 1</Label>
          <Label tone={C.tertiary} className="tabular-nums">
            peak $14
          </Label>
        </div>
      </div>

      {/* Day table. */}
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

      {/* The rest of the pane: the period's shape in one line, then Home's own
       * strip of today's advice, then the caveat that applies to every figure
       * above it. */}
      <div className="flex flex-col gap-[14px] pt-[14px]">
        <Rule />
        <div
          className="flex items-baseline justify-between gap-3 text-[12px]"
          style={{ color: C.secondary }}
        >
          <span>14 active days</span>
          <span style={NUM}>$6.25 · 300 Wh per active day</span>
        </div>

        <Rule />

        <div className="flex flex-col gap-[7px]">
          <div className="flex items-baseline justify-between gap-3">
            <Label>Worth a look today</Label>
            <span className="text-[11px]" style={{ color: C.blue }}>
              all savings ›
            </span>
          </div>
          <div
            className="rounded-md px-2 py-[5px]"
            style={{ background: C.inset }}
          >
            <div className="flex items-baseline gap-[6px]">
              <span className="min-w-0 flex-1 text-[12px] font-medium">
                Try Sonnet 5 as the default, reserving Opus/Fable for hard work
              </span>
              <span
                className="shrink-0 text-[12px]"
                style={{ color: C.green, ...NUM }}
              >
                ~$0.61
              </span>
            </div>
            <p className="mt-[2px] text-[11px]" style={{ color: C.secondary }}>
              77% of your spend ($6.07) is on top-tier models. Sonnet 5 is
              roughly half the energy and a third of the price per token.
            </p>
          </div>
        </div>

        <p className="text-[11px]" style={{ color: C.tertiary }}>
          Cost is exact, from published rates. Energy is a modelled estimate and
          was consumed in a datacenter, not on your Mac.
        </p>
      </div>
    </Screen>
  );
}
