## AgentSpend v0.1.2

AgentSpend now tracks more than Claude Code, and it corrects two prices that
were wrong.

### Your numbers will change, on purpose

Two pricing fixes move historical figures, so past screenshots will not match:

- **Claude Sonnet 5 was overcharged by 50%.** It was priced at $3/$15 per
  million tokens. The published price is $2/$10: the increase planned for
  September was cancelled and the launch price made permanent.
- **Claude Opus 5 is no longer flagged as unrecognized.** It was treated as a
  model with no published price, which put a warning on the largest share of
  most people's usage. The price it was guessing turned out to be the right one,
  so the figure does not move, but the warning goes away.

Cache reads on Fable 5.1 and Mythos 5.1 are also corrected, from a tenth of the
input rate to a fortieth, which is what those models actually bill.

### More than one agent

- **Codex** is read directly, from `~/.codex/sessions`.
- **Fourteen more agent CLIs** are read through a copy of
  [ccusage](https://github.com/ccusage/ccusage) bundled inside the app: OpenCode,
  Amp, Droid, Codebuff, Hermes, pi, Goose, Kilo, GitHub Copilot, Gemini, Kimi,
  Qwen, OpenClaw, and Grok. They appear as soon as you use them, and stay out of
  the way until then.

Nothing is downloaded or installed to make this work, and no network call was
added. The bundled copy runs offline.

### Seeing where it went

The daily and hourly charts are now split by agent, each with its own colour and
logo. Hover any bar for that day's breakdown by agent. The Home panel opens on
Today every time, rather than on whichever window you last looked at.

### Install

Download **`AgentSpend.dmg`** below, open it, and drag AgentSpend to
Applications. Signed with an Apple Developer ID and notarized by Apple, so it
opens with no Gatekeeper warning. Universal binary, Apple Silicon and Intel.

The download is now about 7 MB rather than 3 MB. The bundled ccusage accounts for
all of that. Claude Code and Codex are still read by AgentSpend's own code, which
is both faster and more accurate for those two.

Upgrading from v0.1.1: replace the copy in Applications. Existing history is kept
and upgraded in place on first launch.

### How much to trust these numbers

The dollars are exact arithmetic on published rates. The energy is an estimate,
and is shown for Claude models only. Energy for other vendors is left blank
rather than guessed, because the tier a model belongs to is inferred from its
price, and price does not track compute across vendors. The Method pane shows
every coefficient and its source.

Makes no network calls beyond the once-a-day version check, which you can turn
off. Independent project, not affiliated with Anthropic, OpenAI, Google, GitHub,
or any other vendor whose tools it reads.
