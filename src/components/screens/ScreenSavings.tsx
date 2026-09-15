import { C, Headline, Label, NUM, Screen } from "./chrome";

/*
 * The savings pane, rebuilt in HTML from `AgentSpend --render`'s capture of
 * InsightsView (mac/AgentSpend/UI/InsightsView.swift).
 *
 * Structure follows the SwiftUI view: two headline blocks (money, then the
 * energy behind it) each a caption / figure / footnote stack, the line that
 * says what separates this pane from Home's strip, then the ranked
 * recommendation cards. The figures are the synthetic demo store's, the same
 * ones the capture showed.
 *
 * The app's pane is a fixed 396pt column; this one reflows, so the card's
 * title and evidence wrap to whatever width the tile gives them while the
 * type stays at its real size instead of being scaled down.
 */

/** The disclosure arrow on the card's caveat row, at the app's 8pt. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 8 12"
      fill="none"
      aria-hidden="true"
      className="h-[9px] w-[6px] shrink-0"
    >
      <path
        d="M1.5 1.5 6 6l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One ranked recommendation: action, then the evidence, then the caveat the
 *  logs cannot settle on their own. */
function Rec({
  rank,
  title,
  saving,
  evidence,
}: {
  rank: string;
  title: string;
  saving?: string;
  evidence: string;
}) {
  return (
    <div className="rounded-md p-[10px]" style={{ background: C.inset }}>
      <div className="flex items-baseline gap-[6px]">
        <span
          className="w-[12px] shrink-0 text-right text-[11px]"
          style={{ color: C.secondary, ...NUM }}
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{title}</span>
        {saving ? (
          <span
            className="shrink-0 text-[11px]"
            style={{ color: C.green, ...NUM }}
          >
            {saving}
          </span>
        ) : null}
      </div>

      <p className="mt-[5px] pl-[18px] text-[11px]" style={{ color: C.secondary }}>
        {evidence}
      </p>

      <div
        className="mt-[5px] flex items-center gap-[3px] pl-[18px] text-[11px]"
        style={{ color: C.tertiary }}
      >
        <Chevron />
        <span>caveat</span>
      </div>
    </div>
  );
}

/** The ceiling: what the whole history would have cost on a single model. */
const REPLAY = [
  { model: "opus-4-8", energy: "1.19× energy", delta: "+$82", saves: false },
  { model: "sonnet-5", energy: "0.59× energy", delta: "−$168", saves: true },
  { model: "haiku-4-5", energy: "0.20× energy", delta: "−$417", saves: true },
];

export function ScreenSavings() {
  return (
    <Screen className="gap-[14px] p-4">
      {/* Identified savings: the number the whole pane is arguing for. */}
      <div className="flex flex-col gap-px">
        <Label>Identified savings</Label>
        <Headline tone={C.green}>up to $45</Headline>
        <Label tone={C.tertiary}>against $542 spent to date</Label>
      </div>

      {/* Energy, anchored to something physical. */}
      <div className="flex flex-col gap-px">
        <Label>Energy to date</Label>
        <div
          className="text-[20px] leading-[1.2] font-medium tracking-[-0.01em]"
          style={NUM}
        >
          26.1 kWh
        </div>
        <Label tone={C.tertiary}>≈ 22 hours of a typical US home</Label>
      </div>

      <p className="text-[11px]" style={{ color: C.secondary }}>
        Ranked across your whole history, the patterns, not today.
      </p>

      <div className="flex flex-col gap-2">
        <Rec
          rank="1"
          title="Try Sonnet 5 as the default, reserving Opus/Fable for hard work"
          saving="~$45"
          evidence="82% of your spend ($445) is on top-tier models. Sonnet 5 is roughly half the energy and a third of the price per token."
        />
        <Rec
          rank="2"
          title="Most of your spend is one project, storefront"
          evidence="$174 of $542 (32%) and 8.4 kWh."
        />
      </div>

      {/* The ceiling the recommendations are measured against. */}
      <div className="flex flex-col gap-1">
        <Label>Whole history replayed on one model</Label>
        {REPLAY.map((r) => (
          <div key={r.model} className="flex items-baseline gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate">{r.model}</span>
            <span
              className="shrink-0"
              style={{ color: r.saves ? C.green : C.secondary, ...NUM }}
            >
              {r.energy}
            </span>
            <span
              className="w-[46px] shrink-0 text-right"
              style={{ color: r.saves ? C.green : C.primary, ...NUM }}
            >
              {r.delta}
            </span>
          </div>
        ))}
        <p className="mt-1 text-[11px]" style={{ color: C.tertiary }}>
          A ceiling, not a plan. Nobody should run everything on one model, and
          a weaker model that needs more turns gives the saving back.
        </p>
      </div>
    </Screen>
  );
}
