# Third-party marks

AgentSpend displays each agent's logo to identify whose spend a chart segment
represents. This is nominative use: the marks name the tools the app reads, and
imply no affiliation with or endorsement by their owners.

**The logos are trademarks of their respective owners.** Anthropic (Claude),
Google (Gemini), GitHub/Microsoft (Copilot), Anysphere (Cursor), and the
OpenCode project each own their mark.

The Codex mark is built from `mac/assets/logos/codex.svg`, supplied separately
(sourced via zonalogo.com, not an OpenAI-published asset). OpenAI publishes no
mark in the icon set below. It is redrawn here as a single-colour path; the
original artwork's purple-blue gradient is not reproduced, because in this app
colour carries agent identity and that gradient collides with two other agents.

The remaining glyph geometry is derived from Simple Icons (https://simpleicons.org),
whose *icon files* are released under CC0 1.0. CC0 covers Simple Icons' own
work in redrawing the marks; it does not and cannot license the underlying
trademarks. See `tools/build-agent-logos.py` for how the paths are generated.

Agents with no published mark (Sourcegraph Amp,
Factory Droid, Goose, Grok) are shown with a lettermark in the agent's assigned
colour instead. That is deliberately AgentSpend's own label rather than an
invented logo.

## Colour

Brand colour is used where the brand publishes one that is legible on a dark
surface. Three of these brands specify `#000000`, which measures 1.21:1 contrast
against the chart surface and is indistinguishable from the others; those use a
validated substitute instead. Claude's coral and Gemini's purple were each moved
by one shade to clear the lightness and chroma floors while keeping their hue.
