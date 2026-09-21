"use client";

import { useState } from "react";
import { ScreenToday, type Scope } from "./ScreenToday";

/*
 * The home pane with its picker and its chart wired up, for the hero window.
 *
 * The state lives here rather than inside the pane so the pane itself stays a
 * plain function of its props: the showcase tiles render the same component on
 * the server as a still, with no scope to change and nothing to hover.
 *
 * Switching scope clears the hover. The index means a different column in every
 * window — day 3 of a fortnight, hour 3 of a day — so carrying it across would
 * light up a bar the pointer is nowhere near.
 */
export function ScreenTodayLive({ alt }: { alt: string }) {
  const [scope, setScope] = useState<Scope>("14d");
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <ScreenToday
      alt={alt}
      scope={scope}
      onScope={(next) => {
        setScope(next);
        setHovered(null);
      }}
      hovered={hovered}
      onHover={setHovered}
    />
  );
}
