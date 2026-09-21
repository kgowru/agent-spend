import type { ReactNode } from "react";
import { C, Headline, Label, NUM, Rule, Screen } from "./chrome";
import { AGENTS } from "./agents";
import { count, homeEnergy, usd, wh } from "./format";
import { HourlyBars, type Hour } from "./HourlyBars";
import {
  lastDays,
  TODAY_DAY,
  TODAY_HOURLY,
  TODAY_PROJECTS,
  TODAY_WH_PER_USD,
  TYPICAL_USD,
  type Day,
} from "./history";
import { SegmentedControl } from "./SegmentedControl";

/*
 * The home pane, rebuilt as HTML from the app's own TodayView
 * (mac/AgentSpend/UI/HistoryView.swift) so the type stays vector instead of
 * being a capture scaled down until it goes soft.
 *
 * The picker above the figures is the pane, not a filter on it: at 1d the app
 * draws today against a typical day and shows where the hours went, and at
 * 14d/30d/90d it draws a period against its own average and shows the days.
 * Both are here, because in the hero window the picker works.
 *
 * The colours and logo paths are NOT written here. They come from `agents.ts`,
 * which tools/sync-site-agents.py generates out of the app's own
 * AgentPalette.swift and AgentLogos.swift, so the marketing screen cannot drift
 * from what the app draws. The figures come from `history.ts`.
 *
 * Presentational: scope and hover are props, so a showcase tile renders this on
 * the server as a still and the hero renders it through ScreenTodayLive.
 */

export const SCOPES = ["1d", "14d", "30d", "90d"] as const;
export type Scope = (typeof SCOPES)[number];

/** Chart height in px. The app draws 54pt of bar; this is that at our scale. */
const CHART_H = 70;
/** The app floors a bar at 2pt so a quiet day still reads as a day, not a gap. */
const MIN_BAR = 2;

const COST_W = "w-[56px] sm:w-[70px]";
const ENERGY_W = "w-[60px] sm:w-[76px]";
const REQS_W = "w-[38px] sm:w-[48px]";

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

/*
 * What the number actually is. On a flat rate plan it is a list price
 * equivalent, and the gap is large enough that leaving it unsaid is the biggest
 * overstatement the app could make.
 */
function Caveat() {
  return (
    <Label tone={C.tertiary} className="leading-snug">
      List price, not your bill. You are on Claude Max 5x, which is flat rate.
    </Label>
  );
}

/**
 * What the figures under the picker are showing, for a screen reader.
 *
 * Derived from the scope rather than handed in: the picker changes the whole
 * pane, so a description written once upstream would describe whichever window
 * happened to be open when it was written.
 */
function describe(scope: Scope): string {
  if (scope === "1d") {
    return "Today's spend against a typical day, a chart of when the work happened, and what each project cost.";
  }
  const days = Number(scope.replace("d", ""));
  return `Spend over the last ${days} days beside today's, a bar chart of daily cost split by agent, and a table of cost, energy and requests for each day.`;
}

export function ScreenToday({
  scope = "14d",
  onScope,
  hovered = null,
  onHover,
}: {
  scope?: Scope;
  /** Wired up only in the hero, where the whole pane is under the picker. */
  onScope?: (scope: Scope) => void;
  /** The column the pointer is on: a day index at 14d and up, an hour at 1d. */
  hovered?: number | null;
  onHover?: (column: number | null) => void;
}) {
  const figure =
    scope === "1d" ? (
      <TodaySection hovered={hovered} onHover={onHover} />
    ) : (
      <PeriodSection
        days={Number(scope.replace("d", ""))}
        /* Nothing chose this window, so the period is not the answer to
         * anything: today is the figure, and the fortnight is its context. */
        leadWithToday={!onScope}
        hovered={hovered}
        onHover={onHover}
      />
    );

  /* A still, described by whatever frames it. The showcase tile wraps the
   * whole pane in one `img`, and there is nothing in here to operate. */
  if (!onScope) return <Screen className="gap-4 p-4">{figure}</Screen>;

  return (
    <Screen className="gap-4 p-4">
      <SegmentedControl
        options={SCOPES}
        selected={scope}
        onSelect={onScope}
        label="Window"
      />

      {/* The pane describes its own figures because it also carries a control,
       * and anything inside an `img` is not exposed: wrapping the lot would put
       * the picker out of reach of a screen reader. */}
      <div role="img" aria-label={describe(scope)} className="flex flex-col gap-4">
        {figure}
      </div>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 1d                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Today on its own. The comparison is a trailing 30 day average rather than
 * anything inside the window, because a one day window has no inside.
 */
function TodaySection({
  hovered,
  onHover,
}: {
  hovered: number | null;
  onHover?: (hour: number | null) => void;
}) {
  const today = TODAY_DAY;
  const ratio = today.usd / TYPICAL_USD;

  // Traffic light against a typical day: green while under, yellow as it runs
  // over, red once well past.
  const tone = ratio < 1 ? C.green : ratio < 1.5 ? C.yellow : C.red;

  // Plain language rather than a bare multiplier, which readers have to convert
  // in their heads. Within a tenth either way reads as normal.
  const off = Math.round(Math.abs(ratio - 1) * 100);
  const phrase =
    Math.abs(ratio - 1) < 0.1
      ? "About normal"
      : `${off}% ${ratio < 1 ? "below" : "above"} normal`;

  const hours: Hour[] = TODAY_HOURLY.map((h) => ({
    usd: h,
    // Spread at today's own rate, so an hour's readout is on the same footing
    // as the day's total above it.
    reqs: Math.round((h / today.usd) * today.reqs),
  }));

  const shown = TODAY_PROJECTS.slice(0, 3);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-px">
          <Label>Today</Label>
          <Headline tone={tone}>{usd(today.usd)}</Headline>
          {/* Energy is Anthropic-only, and the app says so rather than
           * presenting a partial total as the whole. */}
          <Label>
            {wh(today.wh)} (Claude Code only) · {count(today.reqs)} requests
          </Label>
          <Label tone={C.tertiary}>{homeEnergy(today.wh)}</Label>
        </div>
        {/* Mirrors the column on the left: label, big number, detail line. */}
        <div className="flex shrink-0 flex-col items-end gap-px text-right">
          <Label>Average</Label>
          <Headline>{usd(TYPICAL_USD)}</Headline>
          <Label tone={ratio > 1.5 ? C.orange : C.secondary}>{phrase}</Label>
        </div>
      </div>

      <Caveat />

      <HourlyBars hours={hours} hovered={hovered} onHover={onHover} />

      <div className="flex flex-col gap-[5px]">
        <div
          className="flex items-baseline gap-[10px] text-[11px]"
          style={{ color: C.secondary }}
        >
          <span className="min-w-0 flex-1">project today</span>
          <span className={`${COST_W} text-right`}>cost</span>
          <span className={`${ENERGY_W} text-right`}>energy</span>
        </div>

        <Rule />

        {shown.map((p) => (
          <div
            key={p.project}
            className="flex items-center gap-[10px] text-[12px] leading-[1.35]"
          >
            <span className="min-w-0 flex-1 truncate">{p.project}</span>
            <span className={`${COST_W} text-right`} style={NUM}>
              {usd(p.usd)}
            </span>
            <span
              className={`${ENERGY_W} text-right`}
              style={{ ...NUM, color: C.secondary }}
            >
              {wh(p.usd * TODAY_WH_PER_USD)}
            </span>
          </div>
        ))}

        {/* A depiction, like Method and Quit in the footer: the pane's job here
         * is the shape of the day, not its long tail of small projects. */}
        <Label tone={C.blue} className="pt-[2px]">
          Show {TODAY_PROJECTS.length - shown.length} more
        </Label>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 14d / 30d / 90d                                                             */
/* -------------------------------------------------------------------------- */

function PeriodSection({
  days,
  leadWithToday = false,
  hovered,
  onHover,
}: {
  days: number;
  leadWithToday?: boolean;
  hovered: number | null;
  onHover?: (day: number | null) => void;
}) {
  const span = lastDays(days);
  const today = span[span.length - 1];
  const active = span.filter((d) => d.reqs > 0);

  const periodUsd = span.reduce((a, d) => a + d.usd, 0);
  const periodWh = span.reduce((a, d) => a + d.wh, 0);
  const periodReqs = span.reduce((a, d) => a + d.reqs, 0);
  const avg = periodUsd / active.length;
  const ratio = today.usd / avg;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {leadWithToday ? (
          <>
            <div className="flex min-w-0 flex-col gap-px">
              <Label>Today</Label>
              <Headline>{usd(today.usd)}</Headline>
              {/* Energy is Anthropic-only, and the app says so rather than
               * presenting a partial total as the whole. */}
              <Label>
                {wh(today.wh)} (Claude Code only) · {count(today.reqs)} requests
              </Label>
              <Label tone={C.tertiary}>{homeEnergy(today.wh)}</Label>
            </div>
            {/* The window the chart below covers, as context for the figure on
             * the left. A rate rather than its own energy total: the qualifier
             * that total would need does not fit a right-aligned column, and a
             * partial number without it is the thing this app argues against. */}
            <div className="flex shrink-0 flex-col items-end gap-px text-right">
              <Label>Last {days} days</Label>
              <Headline>{usd(periodUsd)}</Headline>
              <Label tone={C.tertiary}>{usd(avg)} a day</Label>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-px">
              <Label>Last {days} days</Label>
              <Headline>{usd(periodUsd)}</Headline>
              <Label>
                {wh(periodWh)} (Claude Code only) · {count(periodReqs)} requests
              </Label>
              <Label tone={C.tertiary}>{homeEnergy(periodWh)}</Label>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-px text-right">
              <Label>Today</Label>
              <Headline>{usd(today.usd)}</Headline>
              <Label tone={ratio > 1.5 ? C.orange : C.tertiary}>
                {ratio.toFixed(1)}× the {days}d avg
              </Label>
            </div>
          </>
        )}
      </div>

      <Caveat />

      <DailyBars span={span} hovered={hovered} onHover={onHover} />

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

        {/* Newest first — the recent days are the ones you act on. */}
        {[...active].reverse().map((d) => (
          <div
            key={d.back}
            className="flex items-center gap-[10px] text-[12px] leading-[1.35]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate">{d.label}</div>
              <div className="truncate text-[11px]" style={{ color: C.tertiary }}>
                {d.project}
              </div>
            </div>
            <span className={`${COST_W} text-right`} style={NUM}>
              {usd(d.usd)}
            </span>
            <span
              className={`${ENERGY_W} text-right`}
              style={{ ...NUM, color: C.secondary }}
            >
              {wh(d.wh)}
            </span>
            <span
              className={`${REQS_W} text-right`}
              style={{ ...NUM, color: C.secondary }}
            >
              {count(d.reqs)}
            </span>
          </div>
        ))}
      </div>

      <Rule />

      <div className="flex items-baseline justify-between gap-3">
        <Label>
          {active.length} active day{active.length === 1 ? "" : "s"}
        </Label>
        <Label className="shrink-0">
          <span style={NUM}>
            {usd(avg)} · {wh(periodWh / active.length)}
          </span>{" "}
          per active day
        </Label>
      </div>
    </>
  );
}

/**
 * Daily cost, stacked by agent.
 *
 * Hovering a bar reads out that day above the chart and swaps the legend below
 * it for that day's per agent split, which is the half of this chart that
 * actually answers "how much was Gemini". The rest dim so the focus is clear.
 */
function DailyBars({
  span,
  hovered,
  onHover,
}: {
  span: Day[];
  hovered: number | null;
  onHover?: (day: number | null) => void;
}) {
  const totals = span.map((d) => d.usd);
  const peak = Math.max(...totals);
  const focus = hovered == null ? null : span[hovered];
  const live = Boolean(onHover);

  /* Narrows on long windows: at 90 days a 3px gap spends more of the pane on
   * whitespace than on bars. */
  const gap = span.length > 45 ? 1 : span.length > 20 ? 2 : 3;

  /* Agents anywhere in the window, in palette order. Driven by the window
   * rather than the hovered day, so the legend does not reflow under the
   * pointer. */
  const present = AGENTS.map((_, i) => i).filter((i) =>
    span.some((d) => d.slices[i] > 0),
  );

  return (
    <div className="flex flex-col gap-1">
      {/* Reserves its own height, so the chart does not jump when the pointer
       * arrives, and is deliberately blank when it has not. Only where there is
       * a pointer to arrive: on a showcase tile it is 14px of nothing, pushing
       * the chart down into the crop it is meant to sit above. */}
      {live && (
        <div className="h-[14px] truncate text-[11px] leading-[14px]" style={NUM}>
          {focus ? (
            <>
              {focus.label}
              <span style={{ color: C.secondary }}>
                {"  "}
                {usd(focus.usd)} · {wh(focus.wh)} · {count(focus.reqs)} req
              </span>
            </>
          ) : (
            " "
          )}
        </div>
      )}

      <div
        aria-hidden="true"
        className="flex items-end"
        style={{ height: CHART_H, gap }}
      >
        {span.map((day, i) => {
          const total = totals[i];
          const dimmed = hovered != null && hovered !== i;
          return (
            /* A full-height slot rather than the bar itself, so the thin bars
             * and the gaps between them are all easy to land on. */
            <div
              key={day.back}
              className="flex h-full flex-1 flex-col justify-end"
              title={live ? tooltip(day) : undefined}
              onPointerEnter={onHover && (() => onHover(i))}
              onPointerLeave={onHover && (() => onHover(null))}
            >
              {total === 0 ? (
                // The app draws an untouched day as a dimmed floor rather than
                // a gap, so the window reads as continuous.
                <div
                  className="rounded-[1px]"
                  style={{ height: MIN_BAR, background: C.secondary, opacity: 0.12 }}
                />
              ) : (
                <div
                  className="flex flex-col justify-end overflow-hidden rounded-t-[2px]"
                  style={{
                    height: Math.max(MIN_BAR, (CHART_H * total) / peak),
                    opacity: dimmed ? 0.3 : 1,
                    transition: "opacity 120ms",
                  }}
                >
                  {/* Top down, so the rounded cap lands on the topmost segment.
                   * Palette order, never that day's ranking: a stack that
                   * re-sorted would put a different agent at the same height on
                   * neighbouring bars, which is the comparison the eye makes. */}
                  {day.slices
                    .map((value, a) => ({ value, a }))
                    .filter((s) => s.value > 0)
                    .reverse()
                    .map(({ value, a }) => (
                      <div
                        key={a}
                        style={{
                          height: `${(value / total) * 100}%`,
                          background: AGENTS[a].color,
                        }}
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Today's marker. A dot rather than a colour, because every colour in
       * this chart is spoken for by an agent. */}
      <div aria-hidden="true" className="flex" style={{ gap, height: 3 }}>
        {span.map((day) => (
          <div key={day.back} className="flex flex-1 justify-center">
            {day.back === 0 && (
              <span
                className="block size-[3px] rounded-full"
                style={{ background: C.secondary }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <Label tone={C.tertiary}>{span[0].short}</Label>
        <Label tone={C.tertiary} className="tabular-nums">
          peak {usd(peak)}
        </Label>
      </div>

      {/* Identity is never colour alone: the legend is always present, and
       * hovering a bar swaps it for that day's per agent split. Same slot
       * either way, so the chart never grows or shrinks under the pointer. */}
      <div className="mt-[2px] flex h-[14px] items-center gap-x-3 overflow-hidden">
        {focus
          ? focus.slices
              .map((value, i) => ({ value, i }))
              .filter((s) => s.value > 0)
              .map(({ value, i }) => (
                <Entry key={i} i={i}>
                  <Label>{AGENTS[i].label}</Label>
                  <span className="text-[11px]" style={NUM}>
                    {usd(value)}
                  </span>
                </Entry>
              ))
          : present.map((i) => (
              <Entry key={i} i={i}>
                <Label>{AGENTS[i].label}</Label>
              </Entry>
            ))}
      </div>
    </div>
  );
}

function Entry({ i, children }: { i: number; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[4px] whitespace-nowrap">
      <Mark i={i} />
      {children}
    </span>
  );
}

function tooltip(day: Day): string {
  const head = `${day.label}: ${usd(day.usd)} · ${wh(day.wh)}`;
  const split = day.slices
    .map((value, i) => ({ value, i }))
    .filter((s) => s.value > 0)
    .map(({ value, i }) => `  ${AGENTS[i].label}  ${usd(value)}`);
  return split.length ? `${head}\n${split.join("\n")}` : head;
}
