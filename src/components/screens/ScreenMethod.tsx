import { C, Label, NUM, Rule, Screen } from "./chrome";

/*
 * The methodology pane's baseline table (mac/AgentSpend/UI/ModelsView.swift).
 *
 * Each model gets its energy coefficients next to how much of your own usage it
 * accounts for, and the caveat under the table says how far to trust them.
 *
 * The app pins the three numeric columns to 58 / 62 / 44 pt beside a flexible
 * model column; that ratio is kept here, but as fixed pixel widths so the model
 * column can flex and the pane fills whatever tile it is dropped into.
 */

type ModelRow = {
  /** Model id, one line, truncated by the app if it overflows. */
  model: string;
  /** Your volume and spend on it, the app's `.caption2` sub-line. */
  usage: string;
  whIn: string;
  whOut: string;
  share: string;
};

/* The fixed synthetic demo store (tools/seed-demo-store.py), same figures the
 * capture this replaces was rendered from. */
const ROWS: ModelRow[] = [
  {
    model: "claude-opus-4-8",
    usage: "234.8M tokens · $445",
    whIn: "0.30",
    whOut: "1.20",
    share: "85%",
  },
  {
    model: "claude-sonnet-5",
    usage: "80.6M tokens · $91",
    whIn: "0.15",
    whOut: "0.60",
    share: "14%",
  },
  {
    model: "claude-haiku-4-5",
    usage: "14.1M tokens · $5.28",
    whIn: "0.050",
    whOut: "0.20",
    share: "1%",
  },
];

const COL = {
  whIn: "w-[56px] sm:w-[72px]",
  whOut: "w-[60px] sm:w-[78px]",
  share: "w-[44px] sm:w-[54px]",
} as const;

export function ScreenMethod() {
  return (
    <Screen className="gap-[14px] p-4">
      <Label>Per-model baseline</Label>

      <div className="flex flex-col gap-[7px]">
        <div className="flex items-center gap-[10px]">
          <div className="min-w-0 flex-1">
            <Label>model</Label>
          </div>
          <div className={`${COL.whIn} shrink-0 text-right`}>
            <Label>Wh/1k in</Label>
          </div>
          <div className={`${COL.whOut} shrink-0 text-right`}>
            <Label>Wh/1k out</Label>
          </div>
          <div className={`${COL.share} shrink-0 text-right`}>
            <Label>share</Label>
          </div>
        </div>

        <Rule className="shrink-0" />

        {/* In the capture the model id renders at the same size as the header
         *  above it: the hierarchy there is carried by colour, not by size. So
         *  the row sits one step down from the pane default, matching the other
         *  screens' tables. */}
        {ROWS.map((row) => (
          <div
            key={row.model}
            className="flex items-center gap-[10px] text-[12px]"
          >
            <div className="flex min-w-0 flex-1 flex-col leading-[1.35]">
              <div className="truncate">{row.model}</div>
              <div className="truncate text-[11px]" style={{ color: C.secondary }}>
                {row.usage}
              </div>
            </div>
            <div className={`${COL.whIn} shrink-0 text-right`} style={NUM}>
              {row.whIn}
            </div>
            <div className={`${COL.whOut} shrink-0 text-right`} style={NUM}>
              {row.whOut}
            </div>
            <div className={`${COL.share} shrink-0 text-right`} style={NUM}>
              {row.share}
            </div>
          </div>
        ))}
      </div>

      {/* The app clips this caveat to a single line; the ellipsis is the app's. */}
      <p className="truncate text-[11px]" style={{ color: C.tertiary }}>
        Coefficients are tier estimates anchored to published per-query measurement…
      </p>
    </Screen>
  );
}
