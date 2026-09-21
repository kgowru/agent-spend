"use client";

import { useId, useRef } from "react";
import { SEGMENT, segmentStyle, TRACK } from "./chrome";

/*
 * The scope picker, wired up.
 *
 * The showcase tiles keep the drawing in `chrome.tsx`: a tile is the top of a
 * pane under a crop, so there is nothing below for a scope to change. In the
 * hero the whole window is there, so the picker does what the app's does and
 * the figures under it move.
 *
 * A radio group rather than a row of toggles. Visually it is one control with
 * one answer, and that is how it behaves from the keyboard too: one tab stop
 * for the group, arrow keys within it. Four separate tab stops per pane, in a
 * window that already has a tab bar of its own, would make reaching the rest of
 * the page a chore.
 */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  label,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (option: T) => void;
  /** Names the group, since the segments alone are just "1d" and "14d". */
  label: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const current = options.indexOf(selected);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowDown: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      ArrowUp: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];

    if (next === undefined) return;

    event.preventDefault();
    onSelect(options[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={TRACK.className}
      style={TRACK.style}
    >
      {options.map((option, i) => (
        <button
          key={option}
          ref={(node) => {
            buttons.current[i] = node;
          }}
          type="button"
          role="radio"
          id={`${id}-${option}`}
          aria-checked={option === selected}
          /* Roving tabindex: the group is one stop in the page's tab order and
           * the arrow keys move within it, which is what a radio group is
           * expected to do. */
          tabIndex={option === selected ? 0 : -1}
          onClick={() => onSelect(option)}
          className={`${SEGMENT} cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft`}
          style={segmentStyle(option === selected)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
