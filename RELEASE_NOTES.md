## AgentSpend v0.1.7

AgentSpend now opens when you log in, and its settings have a home.

### Opens at login

AgentSpend adds itself to your login items the first time it runs, so it is
already counting when you start work. Turn it off in Settings, or in System
Settings under General, Login Items. If you turn it off, it stays off.

### Settings

The gear at the bottom of the panel opens Settings. It holds:

- **Menu bar shows:** cost ($) or energy (Wh). This replaces the $ button that
  used to sit in the footer.
- **Open at login.**
- **Check for updates.** The daily version check could be turned off before,
  but there was no switch for it in the app. Now there is.

Everything that was on the Method page is now at the bottom of Settings, with a
short note at the top on where the numbers come from. The Method button is gone
from the footer.

### Install

Download **`AgentSpend.dmg`** below, open it, and drag AgentSpend to
Applications. Signed with an Apple Developer ID and notarized by Apple, so it
opens with no Gatekeeper warning. Universal binary, Apple Silicon and Intel,
about 7 MB.

Upgrading from v0.1.6: replace the copy in Applications. Nothing to migrate.
The first launch after upgrading turns on Open at login.

### How much to trust these numbers

The dollars are exact arithmetic on published rates, and are a list price
equivalent rather than an invoice if you are on a subscription. The energy is an
estimate, shown for Anthropic models only. Settings shows every coefficient,
its range, and its source.

Makes no network calls beyond the once-a-day version check, which you can turn
off. Independent project, not affiliated with Anthropic, OpenAI, Google, GitHub,
or any other vendor whose tools it reads.
