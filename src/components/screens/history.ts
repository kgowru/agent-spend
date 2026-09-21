/*
 * The daily figures behind the Home pane, at every window its picker offers.
 *
 * The most recent fortnight is written out. Those are the days the pane's own
 * table shows, and they are tuned to the figures the rest of the page quotes:
 * they sum to $267, the largest is the "peak $41", and the newest is today's
 * $25.20. The 76 days before it are generated, because 90 hand-written rows is
 * 90 chances to write a number that contradicts the total above it.
 *
 * Generated, not random. A fixed-seed generator keyed on the day itself, so the
 * server and the browser draw the same chart, and a day keeps its shape as the
 * window around it grows from a fortnight to a quarter.
 *
 * Energy and requests are derived rather than written, at the two rates the
 * 14 day headline has always implied: energy only counts Claude Code dollars,
 * which is what makes "(Claude Code only)" true of the per day column as well
 * as the total above it.
 */

/** Dollars per agent, oldest first, indexed to AGENTS. */
const FORTNIGHT: number[][] = [
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

/** The project the day's table row names under its date, oldest first. */
const FORTNIGHT_PROJECTS = [
  "design-system",
  "api-gateway",
  "storefront",
  "api-gateway",
  "design-system",
  "docs-site",
  "api-gateway",
  "design-system",
  "api-gateway",
  "storefront",
  "api-gateway",
  "api-gateway",
  "storefront",
  "api-gateway",
];

const OLDER_PROJECTS = ["api-gateway", "storefront", "design-system", "docs-site"];

/** The longest window the picker offers, and so the length of the dataset. */
const WINDOW = 90;

/**
 * Wh per Claude Code dollar, and requests per dollar. Both are calibrated off
 * the figures the 14 day pane has always quoted — 7.8 kWh and 2,418 requests
 * over $267 — so the fortnight reads exactly as it did while the longer
 * windows get the same treatment instead of a second set of invented totals.
 */
const WH_PER_CLAUDE_USD = 40.13;
const REQS_PER_USD = 9.059;

/* The demo store's "today" is Monday 14 September 2026, which is what makes the
 * oldest bar of the fortnight "Sep 1" and the fourth row down "Fri, Sep 11". */
const TODAY = Date.UTC(2026, 8, 14);
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * One generated day's per agent dollars.
 *
 * Seeded off how far back the day is, so it is the same day every render and
 * the same day in the 30 day window as in the 90. A plain LCG: the shape only
 * has to look like work, and anything with its own state would have to be reset
 * in the right order to stay stable.
 */
function generatedDay(back: number): number[] {
  let seed = (back * 2_654_435_761) % 2_147_483_647 || 1;
  const rand = () => {
    seed = (seed * 48_271) % 2_147_483_647;
    return seed / 2_147_483_647;
  };

  // A handful of days off entirely. The app draws those as a dimmed floor
  // rather than a gap, and a quarter with no untouched day in it is not a
  // quarter anyone has worked.
  if (rand() < 0.07) return [0, 0, 0, 0];

  const weekday = new Date(TODAY - back * DAY_MS).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const scale = (weekend ? 0.22 : 1) * (rand() < 0.12 ? 0.14 : 1);

  const claude = round1((6 + rand() * 27) * scale);
  const codex = round1(claude * (0.12 + rand() * 0.24));
  const gemini = rand() < 0.62 ? round1(claude * (0.03 + rand() * 0.12)) : 0;
  const copilot = rand() < 0.45 ? round1(claude * (0.02 + rand() * 0.06)) : 0;
  return [claude, codex, gemini, copilot];
}

export type Day = {
  /** Days before today. 0 is today. */
  back: number;
  /** Dollars per agent, indexed to AGENTS. */
  slices: number[];
  usd: number;
  /** Claude Code only, which is the only part the energy model can price. */
  wh: number;
  reqs: number;
  project: string;
  /** "Today", "Yesterday", or "Fri, Sep 11". */
  label: string;
  /** "Sep 1", for the date under the left end of the chart. */
  short: string;
};

function dayLabel(back: number): string {
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date(TODAY - back * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function shortLabel(back: number): string {
  const d = new Date(TODAY - back * DAY_MS);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function day(back: number): Day {
  const slices = back < 14 ? FORTNIGHT[13 - back] : generatedDay(back);
  // Rounded, because a sum of one-decimal floats is not one: without this the
  // headline for a quarter carries a tail of binary noise.
  const usd = Math.round(slices.reduce((a, b) => a + b, 0) * 100) / 100;
  return {
    back,
    slices,
    usd,
    wh: slices[0] * WH_PER_CLAUDE_USD,
    reqs: Math.round(usd * REQS_PER_USD),
    project:
      back < 14
        ? FORTNIGHT_PROJECTS[13 - back]
        : OLDER_PROJECTS[back % OLDER_PROJECTS.length],
    label: dayLabel(back),
    short: shortLabel(back),
  };
}

/** Oldest first, which is the order the chart draws them in. */
export const DAYS: Day[] = Array.from({ length: WINDOW }, (_, i) =>
  day(WINDOW - 1 - i),
);

export const TODAY_DAY = DAYS[DAYS.length - 1];

/** The last `days` of the dataset, oldest first. */
export function lastDays(days: number): Day[] {
  return DAYS.slice(-days);
}

/**
 * The typical day the 1d pane compares today against: the trailing 30 days,
 * counting only the days with work on them. A one day window has no internal
 * average of its own to compare to, so the app borrows a month's.
 */
export const TYPICAL_USD = (() => {
  const active = lastDays(30).filter((d) => d.reqs > 0);
  return active.reduce((a, d) => a + d.usd, 0) / active.length;
})();

/*
 * Today, by hour and by project.
 *
 * Written out rather than derived from the day's total: where the work landed
 * is the one thing a daily figure cannot tell you, which is the whole reason
 * the app draws it. Both sum back to today's $25.20, and the project energies
 * sum to today's Wh, so the pane's three views of the day agree.
 */
export const TODAY_HOURLY: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0.4, 1.9, 2.6, 3.4, 1.2,
  0.7, 2.1, 3.8, 2.9, 1.6, 0.9, 0, 0.5, 1.8, 1.4, 0, 0,
];

export const TODAY_PROJECTS: { project: string; usd: number }[] = [
  { project: "api-gateway", usd: 14.8 },
  { project: "storefront", usd: 6.1 },
  { project: "design-system", usd: 3.2 },
  { project: "docs-site", usd: 1.1 },
];

/** Wh per dollar for today specifically, so the project column sums to its Wh. */
export const TODAY_WH_PER_USD = TODAY_DAY.wh / TODAY_DAY.usd;
