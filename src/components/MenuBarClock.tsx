"use client";

import { useSyncExternalStore } from "react";

/*
 * The clock in the menu bar strip, showing the visitor's own date and time and
 * ticking while the page is open. A frozen time reads as a screenshot, which
 * is the one thing the strip is trying not to look like.
 *
 * Driven by `useSyncExternalStore` rather than an effect writing state: the
 * snapshot is the current second, so it is stable across renders within that
 * second (returning `Date.now()` directly would change on every read and spin
 * React forever).
 */

function subscribe(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / 1000);

/* 0 on the server, so the markup React hydrates against matches and the real
 * time appears on the first client render instead of mismatching. */
const getServerSnapshot = () => 0;

/* Built from parts rather than one `toLocaleString`, which would put commas in
 * ("Mon, Sep 14, 10:04:13 PM"). macOS writes it without them. Locale-aware, so
 * a visitor on a 24 hour clock sees their own format. */
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function MenuBarClock() {
  const second = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /* Reserves the row so the strip does not resize as the digits change or when
   * the clock first appears. */
  const shell =
    "min-w-[132px] text-right text-[13px] whitespace-nowrap tabular-nums";

  if (!second) return <span className={shell} />;

  const now = new Date(second * 1000);
  const date = dateFormat.format(now).replace(/,/g, "");

  return (
    <span className={shell}>
      {date} {timeFormat.format(now)}
    </span>
  );
}
