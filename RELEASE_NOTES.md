## AgentSpend v0.1.4

A small one. The warning about models with no figures yet can now be closed.

### The unpriced model warning has a close button

When AgentSpend meets a model it has no price or energy coefficients for, it
says so at the top of the window and counts those requests as zero. That is
worth saying once. It was not worth saying on every launch for the weeks a new
model spends waiting on the next release, with no way to acknowledge it.

So the banner now has an X. What closing it remembers is the exact set of model
names the warning was about, rather than just that a banner was closed once, so
a model you have not seen before brings it back while the ones you already know
about stay quiet.

### Install

Download **`AgentSpend.dmg`** below, open it, and drag AgentSpend to
Applications. Signed with an Apple Developer ID and notarized by Apple, so it
opens with no Gatekeeper warning. Universal binary, Apple Silicon and Intel,
about 7 MB.

Upgrading from v0.1.3: replace the copy in Applications. Nothing to migrate.

### How much to trust these numbers

The dollars are exact arithmetic on published rates, and are a list price
equivalent rather than an invoice if you are on a subscription. The energy is an
estimate, shown for Anthropic models only. The Method pane shows every
coefficient, its range, and its source.

Makes no network calls beyond the once-a-day version check, which you can turn
off. Independent project, not affiliated with Anthropic, OpenAI, Google, GitHub,
or any other vendor whose tools it reads.
