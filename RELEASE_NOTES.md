## AgentSpend v0.1.3

An honesty pass. Three numbers were saying more than they could support, and
this release makes each of them say what it actually knows.

### The headline is not your bill, and now it says so

If you are on a flat rate plan, the dollar figure is what the same tokens would
cost at API rates. It is not money you were charged, and the gap is large: a
fortnight reading $2,272 costs about $50 on Claude Max 5x.

AgentSpend now reads your plan from the config Claude Code already writes, and
labels the figure accordingly:

> List price, not your bill. You are on Claude Max 5x, which is flat rate.

Four keys are read from `~/.claude.json`, none is stored, logged, or sent
anywhere. If you are billed per token, nothing changes and no caveat appears,
because then the number really is your spend.

### Energy is no longer shown for non-Anthropic models

It used to show watt-hours for Codex models. It should not have. Those figures
came from a tier inferred from price, and price does not track compute across
vendors: `gpt-5-codex` lists below Claude Opus 4.5 despite being a flagship, and
DeepSeek measures around eight times GPT-4o per query while listing about ten
times cheaper. The sign is wrong, not just the size.

So energy for those models is withheld rather than guessed, and any total that
covers a mix now says "Claude Code only" instead of quietly presenting a part as
the whole. Cost for those models is unaffected and still exact.

### The README was wrong about the download

It claimed a "~1 MB universal binary". The binary has not been that size for a
while, and since v0.1.2 the download also carries a copy of ccusage. That claim
is gone, along with several other lines that still described a Claude Code only
app.

### Install

Download **`AgentSpend.dmg`** below, open it, and drag AgentSpend to
Applications. Signed with an Apple Developer ID and notarized by Apple, so it
opens with no Gatekeeper warning. Universal binary, Apple Silicon and Intel,
about 7 MB.

Upgrading from v0.1.2: replace the copy in Applications. Nothing to migrate.

### How much to trust these numbers

The dollars are exact arithmetic on published rates, and are a list price
equivalent rather than an invoice if you are on a subscription. The energy is an
estimate, shown for Anthropic models only. The Method pane shows every
coefficient, its range, and its source.

Makes no network calls beyond the once-a-day version check, which you can turn
off. Independent project, not affiliated with Anthropic, OpenAI, Google, GitHub,
or any other vendor whose tools it reads.
