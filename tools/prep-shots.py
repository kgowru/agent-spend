#!/usr/bin/env python3
"""Clean up `AgentSpend --render` output for use as site imagery.

Two fixes:

1. `ImageRenderer` cannot rasterize interactive controls, so a segmented
   picker comes out as a solid yellow "unsupported" placeholder. Crop it off
   rather than ship a screenshot with a broken-looking block in it.
2. Trim the flat background margin so the card frames on the page can control
   their own padding.

    python3 tools/prep-shots.py <render-dir> <out-dir>
"""

import os
import sys

from PIL import Image

# How far above a mid-image placeholder to cut, so the control's own section
# heading goes with it instead of dangling. Expressed against the width the
# value was tuned at, so it tracks AGENTSPEND_RENDER_SCALE instead of cutting
# in the wrong place the moment the render resolution changes.
LABEL_GAP_AT = (52, 840)


def label_gap(width):
    gap, at_width = LABEL_GAP_AT
    return max(1, round(gap * width / at_width))

# SwiftUI's placeholder yellow, matched loosely — it is the only saturated
# yellow in the UI.
def is_placeholder(px):
    r, g, b = px[:3]
    return r > 200 and 140 < g < 225 and b < 90


def placeholder_rows(im):
    w, h = im.size
    rows = []
    for y in range(h):
        hits = sum(1 for x in range(0, w, 7) if is_placeholder(im.getpixel((x, y))))
        if hits > (w / 7) * 0.15:
            rows.append(y)
    return rows


def crop_placeholder(im):
    """Remove the unsupported-control placeholder.

    A placeholder at the very top (the pane's segmented picker) is cut away
    from above; one partway down (the methodology slider) means everything
    from there on is dropped, keeping the clean section above it.
    """
    w, h = im.size
    rows = placeholder_rows(im)
    if not rows:
        return im
    if rows[0] < h * 0.15:
        im = im.crop((0, rows[-1] + 1, w, h))
        # A second placeholder can sit further down the same pane.
        rows = placeholder_rows(im)
        w, h = im.size
        if rows:
            return im.crop((0, 0, w, max(1, rows[0] - label_gap(w))))
        return im
    return im.crop((0, 0, w, max(1, rows[0] - label_gap(w))))


def trim(im, tol=6):
    """Trim uniform border matching the top-left background colour."""
    w, h = im.size
    bg = im.getpixel((2, 2))[:3]

    def flat_row(y):
        return all(
            abs(im.getpixel((x, y))[i] - bg[i]) <= tol
            for x in range(0, w, 5) for i in range(3)
        )

    def flat_col(x):
        return all(
            abs(im.getpixel((x, y))[i] - bg[i]) <= tol
            for y in range(0, h, 5) for i in range(3)
        )

    top = 0
    while top < h - 1 and flat_row(top):
        top += 1
    bottom = h - 1
    while bottom > top and flat_row(bottom):
        bottom -= 1
    left = 0
    while left < w - 1 and flat_col(left):
        left += 1
    right = w - 1
    while right > left and flat_col(right):
        right -= 1

    # Breathing room around the content — but only through the pane's own
    # background. A pane can sit inside a frame of a different colour (the
    # methodology render carries 20 rows of pure black above the card), and
    # padding blindly put that frame straight back into the published asset.
    pad = max(4, round(10 * w / 840))
    inner = im.getpixel((min(w - 1, left + 2), min(h - 1, top + 2)))[:3]

    def matches_inner(px):
        return all(abs(px[i] - inner[i]) <= tol for i in range(3))

    def grow(start, step, limit, sample):
        """Step outward from `start` while the line still reads as background."""
        moved = 0
        pos = start
        while moved < pad:
            nxt = pos + step
            if nxt < 0 or nxt >= limit or not matches_inner(sample(nxt)):
                break
            pos = nxt
            moved += 1
        return pos

    top = grow(top, -1, h, lambda y: im.getpixel((min(w - 1, left + 2), y)))
    bottom = grow(bottom, 1, h, lambda y: im.getpixel((min(w - 1, left + 2), y)))
    left = grow(left, -1, w, lambda x: im.getpixel((x, min(h - 1, top + 2))))
    right = grow(right, 1, w, lambda x: im.getpixel((x, min(h - 1, top + 2))))

    return im.crop((left, top, right + 1, bottom + 1))


def to_alpha(im):
    """Rebuild a flat-background grayscale capture as RGBA.

    The menu bar label renders as light glyphs on the pane's opaque
    background. On the page it sits among transparent SVG glyphs, where an
    opaque rectangle reads as a box drawn around it. The capture is strictly
    grayscale, so the anti-aliasing can be recovered exactly: every pixel is
    the foreground composited over the background at some coverage, and that
    coverage is the alpha we want.
    """
    im = im.convert("RGB")
    w, h = im.size
    pixels = list(im.getdata())
    bg = im.getpixel((0, 0))[0]
    fg = max(p[0] for p in pixels)
    if fg <= bg:
        return im.convert("RGBA")

    span = fg - bg
    out = Image.new("RGBA", (w, h))
    out.putdata([
        (fg, fg, fg, max(0, min(255, round((p[0] - bg) * 255 / span))))
        for p in pixels
    ])
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: prep-shots.py <render-dir> <out-dir>")
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)

    # Rendered pane -> published filename, plus how far down the pane the part
    # actually worth showing runs. Cropping here rather than masking in CSS
    # keeps the subject large in the frame instead of shrinking a full pane
    # into a card and fading most of it away.
    wanted = {
        "content-home": ("shot-today", 0.44),
        "content-sessions": ("shot-sessions", 0.88),
        "content-savings": ("shot-savings", 0.58),
        "content-method": ("shot-method", 1.0),
        "menubar-label": ("shot-menubar", 1.0),
    }

    for stem, (out_name, focus) in wanted.items():
        path = os.path.join(src, f"{stem}.png")
        if not os.path.exists(path):
            print(f"  skip {stem} (missing)")
            continue
        im = Image.open(path).convert("RGB")
        before = im.size
        if stem != "menubar-label":
            im = crop_placeholder(im)
        im = trim(im)
        if focus < 1.0:
            w, h = im.size
            im = im.crop((0, 0, w, int(h * focus)))
        if stem == "menubar-label":
            im = to_alpha(im)
        out = os.path.join(dst, f"{out_name}.png")
        im.save(out, optimize=True)
        kb = os.path.getsize(out) / 1024
        print(f"  {out_name}.png  {before[0]}x{before[1]} -> "
              f"{im.size[0]}x{im.size[1]}  ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
