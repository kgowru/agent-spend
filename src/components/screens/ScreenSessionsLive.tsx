"use client";

import { useState } from "react";
import { ScreenSessions, type Scope } from "./ScreenSessions";

/*
 * The sessions pane with its picker and its chart wired up, for the hero
 * window. State lives here so the pane itself stays a plain function of its
 * props — see ScreenTodayLive, which does the same for Home.
 */
export function ScreenSessionsLive({ alt }: { alt: string }) {
  const [scope, setScope] = useState<Scope>("Today");
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <ScreenSessions
      alt={alt}
      scope={scope}
      onScope={(next) => {
        setScope(next);
        // The chart only exists at Today, so a hovered hour carried into a
        // wider scope would come back lit when the scope came back.
        setHovered(null);
      }}
      hovered={hovered}
      onHover={setHovered}
    />
  );
}
