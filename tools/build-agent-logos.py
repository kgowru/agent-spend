#!/usr/bin/env python3
"""Generate AgentLogos.swift from Simple Icons' SVG path data.

Why normalize here rather than parse SVG in the app: the source paths use the
full command set including elliptical arcs, and arc-to-bezier is the one piece
of SVG path maths that is easy to get subtly wrong. Doing it once in Python and
emitting only absolute M/L/C/Z means the Swift side is a forty-line reader with
nothing to get wrong, and the conversion is reviewable in the generated diff.

Simple Icons ships the *glyph* under CC0, but the logos themselves remain the
trademarks of their owners. They are used here nominatively, to identify whose
spend a bar represents, which is what NOTICE-logos.md records.

    python3 tools/build-agent-logos.py            # uses the pinned version
"""

import json
import math
import os
import re
import subprocess
import sys
import tarfile
import tempfile

VERSION = "16.31.0"

# agent key -> simple-icons file stem. Only the logos that actually exist:
# OpenAI ships no icon in this set (only `openaigym`), and Goose, Droid and
# Grok have none either, so those agents fall back to a lettermark.
WANT = {
    "claude-code": "claude",
    "gemini": "googlegemini",
    "copilot": "githubcopilot",
    "cursor": "cursor",
    "opencode": "opencode",
}

# Logos supplied as files in mac/assets/logos/<agent>.svg rather than pulled
# from simple-icons. Used where the icon set has no entry, or has the wrong one.
# These win over WANT, and their viewBox is scaled to the 24x24 grid, so they do
# not have to be drawn at icon-set dimensions.
LOCAL_DIR = "mac/assets/logos"

NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?')


def tokenize(d):
    out, i = [], 0
    while i < len(d):
        c = d[i]
        if c.isalpha():
            out.append(c); i += 1
        elif c in ' ,\t\n\r':
            i += 1
        else:
            m = NUM.match(d, i)
            if not m:
                raise ValueError(f"bad path data at {i}: {d[i:i+20]!r}")
            out.append(float(m.group())); i = m.end()
    return out


def arc_to_cubics(x0, y0, rx, ry, phi, large, sweep, x, y):
    """Endpoint -> centre parameterization, then split into <=90 degree cubics."""
    if rx == 0 or ry == 0 or (x0 == x and y0 == y):
        return [("L", x, y)]
    rx, ry = abs(rx), abs(ry)
    p = math.radians(phi)
    cosp, sinp = math.cos(p), math.sin(p)
    dx2, dy2 = (x0 - x) / 2.0, (y0 - y) / 2.0
    x1 = cosp * dx2 + sinp * dy2
    y1 = -sinp * dx2 + cosp * dy2
    # Scale radii up if they cannot span the endpoints (SVG F.6.6).
    lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        co = -co
    cx1 = co * rx * y1 / ry
    cy1 = -co * ry * x1 / rx
    cx = cosp * cx1 - sinp * cy1 + (x0 + x) / 2.0
    cy = sinp * cx1 + cosp * cy1 + (y0 + y) / 2.0

    def angle(ux, uy, vx, vy):
        d = math.hypot(ux, uy) * math.hypot(vx, vy)
        if d == 0:
            return 0.0
        c = max(-1.0, min(1.0, (ux * vx + uy * vy) / d))
        a = math.acos(c)
        return -a if ux * vy - uy * vx < 0 else a

    th1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
    dth = angle((x1 - cx1) / rx, (y1 - cy1) / ry,
                (-x1 - cx1) / rx, (-y1 - cy1) / ry)
    if not sweep and dth > 0:
        dth -= 2 * math.pi
    elif sweep and dth < 0:
        dth += 2 * math.pi

    segs = max(1, int(math.ceil(abs(dth) / (math.pi / 2))))
    out, step = [], dth / segs
    # Bezier control-arm length for a circular arc of this sweep.
    t = 4.0 / 3.0 * math.tan(step / 4.0)
    for i in range(segs):
        a0 = th1 + i * step
        a1 = a0 + step
        c0, s0 = math.cos(a0), math.sin(a0)
        c1, s1 = math.cos(a1), math.sin(a1)

        def pt(ca, sa):
            return (cosp * rx * ca - sinp * ry * sa + cx,
                    sinp * rx * ca + cosp * ry * sa + cy)

        p1 = pt(c0, s0)
        p2 = pt(c1, s1)
        d1 = (cosp * -rx * s0 - sinp * ry * c0, sinp * -rx * s0 + cosp * ry * c0)
        d2 = (cosp * -rx * s1 - sinp * ry * c1, sinp * -rx * s1 + cosp * ry * c1)
        out.append(("C", p1[0] + t * d1[0], p1[1] + t * d1[1],
                    p2[0] - t * d2[0], p2[1] - t * d2[1], p2[0], p2[1]))
    return out


def normalize(d):
    """All commands -> absolute M / L / C / Z."""
    t = tokenize(d)
    out = []
    i = 0
    cx = cy = sx = sy = 0.0
    prev_c = None          # last cubic control point, for S/s
    prev_q = None          # last quadratic control point, for T/t
    cmd = None
    while i < len(t):
        if isinstance(t[i], str):
            cmd = t[i]; i += 1
        rel = cmd.islower()
        C = cmd.upper()

        def take(n):
            nonlocal i
            v = t[i:i + n]; i += n
            return [float(x) for x in v]

        if C == 'M':
            x, y = take(2)
            if rel: x, y = cx + x, cy + y
            out.append(("M", x, y)); cx, cy = x, y; sx, sy = x, y
            cmd = 'l' if rel else 'L'      # subsequent pairs are implicit lineto
            prev_c = prev_q = None
        elif C == 'L':
            x, y = take(2)
            if rel: x, y = cx + x, cy + y
            out.append(("L", x, y)); cx, cy = x, y; prev_c = prev_q = None
        elif C == 'H':
            x, = take(1)
            if rel: x = cx + x
            out.append(("L", x, cy)); cx = x; prev_c = prev_q = None
        elif C == 'V':
            y, = take(1)
            if rel: y = cy + y
            out.append(("L", cx, y)); cy = y; prev_c = prev_q = None
        elif C == 'C':
            x1, y1, x2, y2, x, y = take(6)
            if rel:
                x1, y1, x2, y2, x, y = cx+x1, cy+y1, cx+x2, cy+y2, cx+x, cy+y
            out.append(("C", x1, y1, x2, y2, x, y))
            prev_c = (x2, y2); prev_q = None; cx, cy = x, y
        elif C == 'S':
            x2, y2, x, y = take(4)
            if rel: x2, y2, x, y = cx+x2, cy+y2, cx+x, cy+y
            x1, y1 = (2*cx - prev_c[0], 2*cy - prev_c[1]) if prev_c else (cx, cy)
            out.append(("C", x1, y1, x2, y2, x, y))
            prev_c = (x2, y2); prev_q = None; cx, cy = x, y
        elif C == 'Q':
            qx, qy, x, y = take(4)
            if rel: qx, qy, x, y = cx+qx, cy+qy, cx+x, cy+y
            out.append(("C", cx + 2.0/3*(qx-cx), cy + 2.0/3*(qy-cy),
                        x + 2.0/3*(qx-x), y + 2.0/3*(qy-y), x, y))
            prev_q = (qx, qy); prev_c = None; cx, cy = x, y
        elif C == 'T':
            x, y = take(2)
            if rel: x, y = cx+x, cy+y
            qx, qy = (2*cx - prev_q[0], 2*cy - prev_q[1]) if prev_q else (cx, cy)
            out.append(("C", cx + 2.0/3*(qx-cx), cy + 2.0/3*(qy-cy),
                        x + 2.0/3*(qx-x), y + 2.0/3*(qy-y), x, y))
            prev_q = (qx, qy); prev_c = None; cx, cy = x, y
        elif C == 'A':
            rx, ry, rot, large, sweep, x, y = take(7)
            if rel: x, y = cx+x, cy+y
            out.extend(arc_to_cubics(cx, cy, rx, ry, rot, int(large), int(sweep), x, y))
            cx, cy = x, y; prev_c = prev_q = None
        elif C == 'Z':
            out.append(("Z",)); cx, cy = sx, sy; prev_c = prev_q = None
        else:
            raise ValueError(f"unhandled command {cmd!r}")
    return out


def emit(ops, viewbox=(0, 0, 24, 24)):
    """Serialize, mapping the source viewBox onto the 24x24 grid the app draws on.

    Uniform scale with centring, not an independent x/y stretch: a logo squashed
    to fit a square is worse than one that does not fill it, and these are other
    people's trademarks.
    """
    vx, vy, vw, vh = viewbox
    # Some artwork overruns its own declared viewBox (the Codex mark reaches
    # 252 of a stated 250). Fit the UNION of the two, so that art is contained
    # rather than clipped, while artwork that sits inside its viewBox keeps the
    # padding its designer intended and is not silently scaled up.
    xs = [v for op in ops for v in op[1::2]]
    ys = [v for op in ops for v in op[2::2]]
    if xs and ys:
        vx2, vy2 = min(vx, min(xs)), min(vy, min(ys))
        vw = max(vx + vw, max(xs)) - vx2
        vh = max(vy + vh, max(ys)) - vy2
        vx, vy = vx2, vy2
    s = 24.0 / max(vw, vh)
    ox = (24.0 - vw * s) / 2.0
    oy = (24.0 - vh * s) / 2.0

    def fx(v):
        return (v - vx) * s + ox

    def fy(v):
        return (v - vy) * s + oy

    def n(v):
        return f"{v:.3f}".rstrip('0').rstrip('.')

    parts = []
    for op in ops:
        if len(op) == 1:
            parts.append(op[0])
            continue
        vals = []
        for i, v in enumerate(op[1:]):
            vals.append(n(fx(v) if i % 2 == 0 else fy(v)))
        parts.append(op[0] + " " + " ".join(vals))
    return " ".join(parts)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp = tempfile.mkdtemp()
    subprocess.run(["npm", "pack", f"simple-icons@{VERSION}", "--silent"],
                   cwd=tmp, check=True, capture_output=True)
    tgz = [f for f in os.listdir(tmp) if f.endswith(".tgz")][0]
    with tarfile.open(os.path.join(tmp, tgz)) as tar:
        tar.extractall(tmp)
    icons = os.path.join(tmp, "package", "icons")
    data = json.load(open(os.path.join(tmp, "package", "data", "simple-icons.json")))
    entries = data["icons"] if isinstance(data, dict) else data
    by_title = {i["title"].lower().replace(" ", "").replace(".", ""): i for i in entries}

    lines = [
        "// Generated by tools/build-agent-logos.py. Do not edit by hand.",
        f"// Source: simple-icons@{VERSION} (glyphs CC0). The marks themselves remain",
        "// the trademarks of their respective owners; see NOTICE-logos.md.",
        "//",
        "// Paths are normalized to absolute M/L/C/Z on a 24x24 grid, so the reader in",
        "// SVGPath.swift needs no arc or smooth-curve maths.",
        "",
        "enum AgentLogos {",
        "    /// Agent key -> normalized path data on a 24x24 grid.",
        "    static let paths: [String: String] = [",
    ]
    # Local files first, then the icon set for anything not overridden.
    local_dir = os.path.join(root, LOCAL_DIR)
    local = {}
    if os.path.isdir(local_dir):
        for f in sorted(os.listdir(local_dir)):
            if f.endswith(".svg"):
                local[f[:-4]] = os.path.join(local_dir, f)

    agents = list(dict.fromkeys(list(WANT) + list(local)))
    for agent in agents:
        if agent in local:
            svg = open(local[agent]).read()
            src = f"{LOCAL_DIR}/{agent}.svg"
        else:
            svg = open(os.path.join(icons, f"{WANT[agent]}.svg")).read()
            stem = WANT[agent]
            src = f"simple-icons {stem} (brand #{by_title.get(stem, {}).get('hex', '??????')})"

        # A multi-path logo would need fills merged and even-odd rules resolved,
        # which this does not do. Fail rather than silently draw the first path
        # and call it the logo.
        paths = re.findall(r'\sd="([^"]+)"', svg)
        if len(paths) != 1:
            raise SystemExit(f"{agent}: expected 1 path, found {len(paths)} in {src}")

        vb = re.search(r'viewBox="([-\d.\s]+)"', svg)
        viewbox = tuple(float(v) for v in vb.group(1).split()) if vb else (0, 0, 24, 24)
        ops = normalize(paths[0])
        lines.append(f'        // {agent}: {src}, viewBox {viewbox[2]:g}x{viewbox[3]:g}')
        lines.append(f'        "{agent}": "{emit(ops, viewbox)}",')
    lines += ["    ]", "}", ""]

    out = os.path.join(root, "mac", "AgentSpend", "UI", "AgentLogos.swift")
    open(out, "w").write("\n".join(lines))
    print(f"wrote {out} ({len(agents)} logos)")
    for agent in agents:
        print(f"  {agent:14} <- {'local ' + LOCAL_DIR if agent in local else 'simple-icons'}")


if __name__ == "__main__":
    main()
