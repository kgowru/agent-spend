/*
 * The app's `Format` enum (mac/AgentSpend/UI/Format.swift), ported.
 *
 * Written out rather than reached for through `Intl`: the panes render once on
 * the server and again in the browser, and a figure that groups or rounds
 * differently in the two places is a hydration mismatch. Fixed separators
 * behave the same everywhere.
 */

/** Grouped to thousands, fixed decimals. `NumberFormatter(.decimal)`. */
function decimal(value: number, places: number): string {
  const [whole, fraction] = Math.abs(value).toFixed(places).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ",");
  return (value < 0 ? "-" : "") + (fraction ? `${grouped}.${fraction}` : grouped);
}

/** Cents under ten dollars, whole dollars above. */
export function usd(value: number): string {
  return "$" + decimal(value, value < 10 ? 2 : 0);
}

/** Wh below a kilowatt-hour, kWh above. Keeps the menu bar item narrow. */
export function wh(value: number): string {
  return value >= 1000
    ? `${decimal(value / 1000, 1)} kWh`
    : `${decimal(value, value < 10 ? 2 : 0)} Wh`;
}

/** A plain grouped integer — "2,418", not "2.4k". */
export function count(n: number): string {
  return decimal(n, 0);
}

/** Token counts, where compactness matters more than the exact figure. */
export function tokens(n: number): string {
  if (n >= 1e9) return `${decimal(n / 1e9, 2)}B`;
  if (n >= 1e6) return `${decimal(n / 1e6, 1)}M`;
  if (n >= 1e3) return `${decimal(n / 1e3, 1)}k`;
  return `${n}`;
}

/** The app's one energy anchor, from mac/AgentSpend/Resources/energy-model.json. */
const US_HOME_KWH_PER_DAY = 29;

/**
 * Energy as time spent running a typical US home, scaled minutes → hours →
 * days → weeks so it always reads naturally.
 */
export function homeEnergy(value: number): string {
  const days = value / 1000 / US_HOME_KWH_PER_DAY;
  const suffix = " of a typical US home";

  if (days < 1 / 24) {
    const mins = days * 24 * 60;
    return `≈ ${decimal(mins, mins < 10 ? 1 : 0)} min${suffix}`;
  }
  if (days < 1) {
    const hours = days * 24;
    return `≈ ${decimal(hours, hours < 10 ? 1 : 0)} hours${suffix}`;
  }
  if (days < 14) return `≈ ${decimal(days, days < 10 ? 1 : 0)} days${suffix}`;

  const weeks = days / 7;
  return `≈ ${decimal(weeks, weeks < 10 ? 1 : 0)} weeks${suffix}`;
}
