#!/usr/bin/env python3
"""Render every agent mark to a standalone HTML page for review.

The page draws from the SAME generated path data the app uses
(AgentSpend/UI/AgentLogos.swift) and the same assigned colours
(AgentSpend/UI/AgentPalette.swift), so what you see here is what the app draws.
It is not a mock-up of the marks; it is the marks.

    python3 tools/build-logo-review.py && open /tmp/agentspend-logos.html
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(ROOT, "mac/AgentSpend/UI/AgentLogos.swift")
PALETTE = os.path.join(ROOT, "mac/AgentSpend/UI/AgentPalette.swift")
OUT = "/tmp/agentspend-logos.html"

# Where each mark comes from, and what it is. Kept here rather than derived,
# because "no vendor publishes one" is a fact about the world that the generated
# file cannot know.
PROVENANCE = {
    "claude-code": ("Anthropic Claude", "Simple Icons <code>claude</code>", "brand #D97757, snapped into the lightness band"),
    "codex":       ("OpenAI Codex", "supplied file <code>mac/assets/logos/codex.svg</code>", "OpenAI teal; the file's own purple-blue gradient collides with Gemini and Amp"),
    "gemini":      ("Google Gemini", "Simple Icons <code>googlegemini</code>", "brand #8E75B2, chroma raised to clear the floor"),
    "copilot":     ("GitHub Copilot", "Simple Icons <code>githubcopilot</code>", "substitute: GitHub specifies #000000, unusable on dark"),
    "amp":         ("Sourcegraph Amp", "none published", "substitute"),
    "droid":       ("Factory Droid", "none published", "substitute"),
    "opencode":    ("OpenCode", "Simple Icons <code>opencode</code>", "substitute: specifies #000000"),
    "goose":       ("Goose", "none published", "substitute"),
    "cursor":      ("Cursor", "Simple Icons <code>cursor</code>", "generated but UNUSED: Cursor is not a tracked agent"),
}


def parse_paths():
    s = open(LOGOS).read()
    return dict(re.findall(r'"([a-z-]+)": "([^"]+)"', s))


def parse_palette():
    s = open(PALETTE).read()
    order = re.search(r'static let order = \[(.*?)\]', s, re.S).group(1)
    order = re.findall(r'"([a-z-]+)"', order)
    colors = {}
    for agent, r, g, b in re.findall(
            r'"([a-z-]+)":\s*Color\(red:\s*([\d.]+),\s*green:\s*([\d.]+),\s*blue:\s*([\d.]+)\)', s):
        colors[agent] = "#%02x%02x%02x" % tuple(round(float(v) * 255) for v in (r, g, b))
    labels = dict(re.findall(r'case "([a-z-]+)":\s*return "([^"]+)"', s))
    return order, colors, labels


def card(agent, d, color, label, kind):
    who, source, note = PROVENANCE.get(agent, (label, "?", "?"))
    if d:
        mark = (f'<svg viewBox="0 0 24 24" class="glyph"><path d="{d}" fill="{color}"/></svg>')
        badge = '<span class="tag real">logo</span>'
    else:
        mark = (f'<div class="letter" style="color:{color}">{label[0]}</div>')
        badge = '<span class="tag letter-tag">lettermark</span>'
    sizes = "".join(
        f'<div class="sz"><svg viewBox="0 0 24 24" style="width:{px}px;height:{px}px">'
        f'<path d="{d}" fill="{color}"/></svg><span>{px}px</span></div>'
        if d else
        f'<div class="sz"><div class="letter" style="color:{color};font-size:{px*0.78:.0f}px;'
        f'width:{px}px;height:{px}px">{label[0]}</div><span>{px}px</span></div>'
        for px in (9, 12, 18, 28))
    return f"""
    <article class="card{' unused' if kind == 'unused' else ''}">
      <header>
        <div class="big">{mark}</div>
        <div class="meta">
          <h2>{label} {badge}</h2>
          <p class="who">{who}</p>
          <p class="src">{source}</p>
        </div>
      </header>
      <div class="swatchrow">
        <span class="chip" style="background:{color}"></span>
        <code>{color}</code>
        <span class="note">{note}</span>
      </div>
      <div class="sizes">{sizes}</div>
      <div class="inline">
        <span class="legend-sample">
          {mark.replace('class="glyph"', 'class="inline-glyph"').replace('class="letter"', 'class="inline-letter"')}
          <span>{label}</span><b>$12.40</b>
        </span>
      </div>
    </article>"""


def main():
    paths = parse_paths()
    order, colors, labels = parse_palette()

    used = [a for a in order]
    unused = [a for a in paths if a not in order]

    cards = "".join(card(a, paths.get(a), colors.get(a, "#888"),
                         labels.get(a, a.title()), "used") for a in used)
    extra = "".join(card(a, paths.get(a), colors.get(a, "#888"),
                         labels.get(a, a.title()), "unused") for a in unused)

    have = sum(1 for a in used if a in paths)
    html = f"""<!doctype html>
<meta charset="utf-8">
<title>AgentSpend marks</title>
<style>
  :root {{ color-scheme: dark; --bg:#1a1a19; --card:#232322; --ink:#f2f2ef; --dim:#a3a29b; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; padding:32px; background:var(--bg); color:var(--ink);
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif; }}
  h1 {{ font-size:20px; margin:0 0 4px; }}
  .sub {{ color:var(--dim); margin:0 0 28px; max-width:68ch; }}
  .grid {{ display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); }}
  .card {{ background:var(--card); border:1px solid #2f2f2d; border-radius:10px; padding:16px; }}
  .card.unused {{ opacity:.55; border-style:dashed; }}
  header {{ display:flex; gap:14px; align-items:center; margin-bottom:12px; }}
  .big {{ width:56px; height:56px; flex:none; display:grid; place-items:center;
          background:#151514; border-radius:10px; }}
  .big svg {{ width:36px; height:36px; }}
  .big .letter {{ font:700 28px/1 ui-rounded,-apple-system,system-ui; }}
  .meta h2 {{ font-size:15px; margin:0 0 2px; display:flex; gap:8px; align-items:center; }}
  .who {{ margin:0; color:var(--dim); font-size:12px; }}
  .src {{ margin:2px 0 0; color:#6f6e68; font-size:11px; }}
  .src code {{ background:#151514; padding:1px 4px; border-radius:3px; }}
  .tag {{ font-size:10px; font-weight:700; letter-spacing:.4px; padding:2px 6px;
          border-radius:99px; text-transform:uppercase; }}
  .tag.real {{ background:#1d3a2b; color:#7ddCa4; }}
  .tag.letter-tag {{ background:#3a3320; color:#e0c06a; }}
  .swatchrow {{ display:flex; align-items:center; gap:8px; font-size:11px;
                padding:8px 0; border-top:1px solid #2f2f2d; }}
  .chip {{ width:14px; height:14px; border-radius:4px; flex:none; }}
  .swatchrow code {{ color:var(--dim); }}
  .note {{ color:#6f6e68; }}
  .sizes {{ display:flex; gap:16px; align-items:flex-end; padding:10px 0;
            border-top:1px solid #2f2f2d; }}
  .sz {{ display:grid; place-items:center; gap:4px; }}
  .sz span {{ font-size:9px; color:#6f6e68; }}
  .sz .letter {{ display:grid; place-items:center; font-weight:700;
                 font-family:ui-rounded,-apple-system,system-ui; }}
  .inline {{ border-top:1px solid #2f2f2d; padding-top:10px; }}
  .legend-sample {{ display:inline-flex; align-items:center; gap:5px; font-size:11px;
                    color:var(--dim); }}
  .legend-sample b {{ color:var(--ink); font-variant-numeric:tabular-nums; }}
  .inline-glyph {{ width:9px; height:9px; }}
  .inline-letter {{ font:700 7px/1 ui-rounded,system-ui; width:9px; height:9px;
                    display:grid; place-items:center; }}
  h3 {{ margin:36px 0 12px; font-size:13px; color:var(--dim); font-weight:600;
        text-transform:uppercase; letter-spacing:.6px; }}
</style>
<h1>AgentSpend agent marks</h1>
<p class="sub">Drawn from the same generated path data and assigned colours the app uses, so this is
what the app renders, not a mock-up. <b>{have} of {len(used)}</b> tracked agents have a real logo;
the rest fall back to a lettermark because no vendor publishes one in a usable form.
The 9px row is the size used in the chart legend and hover readout.</p>
<div class="grid">{cards}</div>
<h3>Generated but not used</h3>
<div class="grid">{extra}</div>
"""
    open(OUT, "w").write(html)
    print(f"wrote {OUT}")
    print(f"  {have}/{len(used)} tracked agents have a logo")
    for a in used:
        print(f"    {a:14} {'logo' if a in paths else 'lettermark':10} {colors.get(a,'?')}")
    for a in unused:
        print(f"    {a:14} {'logo (unused)':10}")


if __name__ == "__main__":
    main()
