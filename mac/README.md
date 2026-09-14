# AgentSpend

A macOS menu bar app that turns your Claude Code and Codex token spend into
estimated electricity and dollars, so "switch to a cheaper model" becomes a
quantified decision instead of a hunch.

Reads `~/.claude/projects` and `~/.codex/sessions` directly. No API keys, no
network, fully offline.

```
./build-app.sh          # build build/AgentSpend.app
open build/AgentSpend.app
```

Native Swift, zero external dependencies (SQLite comes from the system). ~1 MB
bundle, 0% CPU at idle — a tool that burns power to report power would undercut
its own premise.

## What it shows

| Pane | |
|---|---|
| **Home** | Day-by-day cost and energy over 1/14/30/90 days and today against your own daily average, then the one or two things worth acting on — scoped to *today*, so it speaks to the work still running |
| **Sessions** | Recent sessions — project, branch, model, cost, and context size; hourly breakdown |
| **Savings** | The same recommender over your whole history: ranked, quantified changes to how you work, each with its evidence and its caveat |
| **Method** | Per-model baseline, every coefficient with its band and source, and the one slider that matters. Reached from the link in the footer, not the tab bar — it's read once, not lived in |

## The honest caveat

**No frontier vendor publishes per-token energy. Anthropic publishes nothing at
all.** Every Claude energy figure in circulation, including this one, is
third-party modeling. Measured energy for the same model on the same GPU varies
~100× between naive and optimized serving.

So the app leads with **cost** (exact arithmetic on published rates) and
**relative** model comparisons (robust, because the shared serving-efficiency
unknowns largely cancel), and presents absolute Wh as a banded estimate with its
sources shown.

Coefficients are anchored to the three independent measurements that converge on
~0.3 Wh for a median frontier query — Google's Gemini disclosure (0.24 Wh),
Microsoft's peer-reviewed *Joule* study (0.31 Wh), and Epoch AI's GPT-4o model
(0.30 Wh) — then scaled by tier. See the Method pane for the full list.

**The dominant uncertainty is `cacheReadFactor`.** Cache reads are ~95% of local
Claude Code token volume, so whether a cache hit costs 10% or 1% of a fresh
input token swings the total ~4.7×. There is no published energy measurement of
a prompt-cache hit — the 10% price discount is a billing decision, not a
measured ratio. It's a slider in the Method pane rather than a buried constant.

## Sources

Two agent CLIs:

| Tool | Logs | Identity |
|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` | `message.id` |
| Codex | `~/.codex/sessions/**/rollout-*.jsonl` | `(session, cumulative total)` |

Both sources are always constructed, even when the directory is absent — an
empty root simply enumerates no files, so a tool you never run still shows
nothing. Filtering absent roots at launch looked tidier and was a bug: the 60s
rescan backstop lives inside the watcher, so dropping the source dropped the
self-heal with it, and a CLI installed after the app started was never picked
up until the next relaunch.

Each source gets its own FSEvents watcher, and changed paths are matched to a
source against the *resolved* root — FSEvents reports canonicalized paths, so a
symlinked `~/.codex` would otherwise match nothing and silently turn every live
refresh into a no-op. Paths matching no root are offered to every parser rather
than dropped; a parser handed the other format finds no usage marker and
contributes nothing.

**Codex disagrees with Claude Code on four things that change the arithmetic.**
Each is a way to be quietly wrong rather than visibly broken:

1. **`input_tokens` already contains `cached_input_tokens`** — the opposite of
   Anthropic's split. Verified on the real corpus: `total_tokens == input_tokens
   + output_tokens`, with the cached count nested inside input. Passing the raw
   figure through bills 2.1M cached tokens at the full input rate on a single
   session. `UsageRecord.input` means *uncached* input, and the subtraction
   happens at the parser boundary so nothing downstream has to know.
2. **`reasoning_output_tokens` is a subset of `output_tokens`**, not an addition.
   Adding it double-counts the priciest class. `cache_write_input_tokens` is
   likewise a component of `input_tokens` and is subtracted out for the same
   reason — billing it as fresh input *and* as a write is 2.25x on GPT-5.6.
   Every observed row has a zero write count, so that half is reasoned from the
   `total == input + output` identity rather than measured, and a row that
   contradicts it increments a counter instead of being clamped away.
3. **Model and cwd arrive on a different event.** They appear once in
   `turn_context`; every later `token_count` row depends on having seen it.
   Because a resumed pass starts at a byte offset well past that event, the
   state is persisted in the `FileIndex` entry — without that, every record
   after the first restart would be unattributable.

Cache terms are per-model, not global. Anthropic charges a premium to *write*
the cache (1.25x at the 5-minute TTL, 2x at the hour); OpenAI charged nothing
until GPT-5.6, which introduced a 1.25x write charge. One vendor's contract
applied to the other silently mis-bills.

**Dollars for a subscription plan are a list-price equivalent, not money
charged.** Codex logs record `plan_type`, and on a ChatGPT plan the tokens are
absorbed by the subscription rather than billed at API rates. The same is true
of Claude Code on Max. The figure remains the right one for comparing models
against each other; it is not an invoice.

## Ingestion, and why it's fussy

Four things that are easy to get wrong, each verified against the real corpus:

1. **Dedup on `message.id`, keeping max `output_tokens`.** ~52% of usage rows
   are repeats: a streaming message is logged many times with a *partial* output
   count. First-wins keeps the partial and undercounts total output by **12.6%**
   — the priciest (5×) and most energy-intensive (4×) token class. Every
   non-output field is identical across repeats (0 conflicts of 21,782 ids),
   which is what makes max-output provably safe. `requestId` can't be the key:
   it's missing on `<synthetic>` rows.
2. **Walk recursively.** Sessions live at `<project>/<session>.jsonl`, but
   subagent transcripts nest at `<project>/<session>/subagents/agent-*.jsonl`. A
   one-level glob finds 143 of 623 files — **77% missing**.
3. **Normalize dated model IDs.** IDs appear as both `claude-haiku-4-5` and
   `claude-haiku-4-5-20251001`. Unnormalized, dated rows match no coefficient
   and are silently counted as zero. An unmatched model is now a loud banner.
4. **Buffer partial trailing lines.** Logs are appended to live, so a read can
   land mid-line.

Steady state reads only appended bytes, and the FSEvents watcher passes the
changed paths through so a refresh touches only those files rather than
re-stat'ing all ~600 logs.

## A layout trap worth knowing about

`MenuBarExtra` proposes its own height during layout, and a `ScrollView` under
`maxHeight` can resolve that proposal to zero — the popover renders its chrome
and nothing else. This shipped once. The fix is a fully concrete `.frame(width:
420, height: 540)` on the root, which no proposal can collapse.

Worth knowing because **none of the offscreen checks caught it**: `ImageRenderer`
proposes a concrete size, and `NSHostingController.fittingSize` asks for the
ideal size, so both reported a healthy 535pt for the broken layout. Only the
live popover shows it. `LayoutProbe` writes the real laid-out size to
`~/Library/Application Support/AgentSpend/layout-probe.txt` on first open, so
it can be checked without a screenshot.

`ImageRenderer` also can't rasterize `ScrollView` children or interactive
controls, which is why `--render` snapshots each pane standalone as well as
hosted — the standalone shots verify content, the hosted ones verify layout.

## Performance, and the token question

**The analytics cost zero tokens.** Every figure — day-by-day history, per-session
summaries, the ranked recommendations — is local arithmetic over the SQLite
store in Swift. Nothing here calls an LLM. The app reads Claude Code's logs; it
never talks to the API. So "burning tokens to create the analytics" can't
happen by construction.

What *can* cost is CPU, and the Insights pane originally did — it took ~2.7s to
open on a ~23k-record corpus. Two bugs, both found with `--bench`:

- `Recommender.build` accumulated rows into a dictionary of tuples and appended
  to an array pulled out by value, forcing a full copy-on-write of the array
  every iteration — **O(n²)**, ~2,600ms of the 2,700. Fixed by grouping with
  in-place appends (`dict[k, default: []].append`): **9ms**.
- `EnergyModel.tier(for:)` rebuilt a lookup dictionary on every call, and it's
  called once per record in every pass — ~100k rebuilds per render. The
  `Estimator` now builds the tier and entry lookups once at init.

Full Insights compute: **2,681ms → 61ms** (42×). On top of that, the derived
products are **memoized against a data-version counter**, so a pane that's open
while you work recomputes only when new usage rows actually land — an incidental
redraw (the refresh spinner toggling, the "updated" timestamp) is a **0ms** memo
hit. `--bench` prints the cold and memo numbers.

**Refresh cadence:** the FSEvents watcher coalesces file changes over 2s and
re-ingests only the changed files (not a full rescan), with a 60s timer as a
backstop. A refresh bumps the data-version only when it actually merges new
rows, so the memo survives no-op refreshes.

## Verifying

```
./.build/release/AgentSpend --selftest          # 136 assertions
./.build/release/AgentSpend --verify [root]     # aggregates, diffable vs the oracle
./.build/release/AgentSpend --verify-codex [root]  # the same, for Codex logs
./.build/release/AgentSpend --render <dir>    # render each pane to PNG
./.build/release/AgentSpend --window [--tab method]   # views in a normal window
./.build/release/AgentSpend --bench           # time the derived analytics (cold + memo)
```

`tools/prototype.py` is an independent Python implementation of the same parse
and model, and is the reference the Swift ingestor is checked against — on a
frozen snapshot the two agree exactly, to the token and the cent:

```
python3 tools/prototype.py --root /tmp/snap
./.build/release/AgentSpend --verify /tmp/snap
```

`tools/verify.py` asserts the dedup and idempotence properties against the live
corpus from a separate code path.

Tests are plain assertions in `--selftest` rather than XCTest because the
installed Xcode predates this macOS and its XCTest can't load; requiring an
Xcode reinstall to run the tests would be a bad trade.

## Not done

Notifications for unusually hot sessions, and live grid carbon via Electricity
Maps.

Known gaps in the Codex path, none of them silent: the prescan byte-scans each
line up to three times where the Claude parser scans once (one cold-parse cost,
not a steady-state one); `plan_type` is captured into the parse context but no
pane reads it yet, so the subscription caveat above lives only in this file;
`--verify-codex` is a per-provider flag where `--verify --provider codex` would
generalize; and `FileIndex.Entry.context` is a stringly-typed bag whose keys are
checked by nothing.

`tools/prototype.py` still parses Claude Code logs only. It remains the oracle
for that path — the frozen-snapshot diff is exact — but the Codex parser is
covered by `--selftest` and by `--verify-codex` diffed against an independent
reimplementation, not by the Python oracle.

Grok Build (`~/.grok/sessions/**/updates.jsonl`) is the obvious next source and
records a per-turn `costUsdTicks`. Note `~/.grok` is shared with an unrelated
third-party CLI of the same name, so a parser has to disambiguate by file
presence rather than assume the format.

Cursor is deliberately excluded: its local token counts cover ~7% of messages,
carry no model attribution, and its real spend lives behind a team-admin API
key — which the app's offline guarantee rules out.

Release builds are Developer ID signed and notarized (see `RELEASING.md`);
`build-app.sh` still ad-hoc signs for fast local iteration.
