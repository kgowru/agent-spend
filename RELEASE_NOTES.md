## AgentSpend v0.1.5

Less text on screen, and empty days that look empty rather than broken.

### The list price line is gone

Since v0.1.3, a line under the headline named your plan and said the dollar
figure was a list price, not your bill. It took two lines in a pane you read at
a glance, and it showed on every launch. The Method pane and the README already
say the same thing, so the line is gone.

AgentSpend no longer reads `~/.claude.json` at all. That file was only read to
fill in that line.

### Empty days look empty

On a day with no priced usage, the hourly chart used to draw as a blank strip,
which looked like a chart that failed to load. It now draws a faint placeholder
in each hour, flat and even so it can't be mistaken for data.

"Nothing worth flagging in today's usage" now has an icon beside it, so an
empty savings strip reads as a state rather than a gap.

### Smaller fixes

The unpriced model warning names the models and stops there. The second line,
saying those requests count as zero, repeated what the headline already shows.

"all savings" is now "All savings", like every other control.

### Install

Download **`AgentSpend.dmg`** below, open it, and drag AgentSpend to
Applications. Signed with an Apple Developer ID and notarized by Apple, so it
opens with no Gatekeeper warning. Universal binary, Apple Silicon and Intel,
about 7 MB.

Upgrading from v0.1.4: replace the copy in Applications. Nothing to migrate.

### How much to trust these numbers

The dollars are exact arithmetic on published rates, and are a list price
equivalent rather than an invoice if you are on a subscription. The energy is an
estimate, shown for Anthropic models only. The Method pane shows every
coefficient, its range, and its source.

Makes no network calls beyond the once-a-day version check, which you can turn
off. Independent project, not affiliated with Anthropic, OpenAI, Google, GitHub,
or any other vendor whose tools it reads.
