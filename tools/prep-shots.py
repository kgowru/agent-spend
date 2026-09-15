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

# How far above a mid-image placeholder to cut, so the control's own
# section heading goes with it instead of dangling.
LABEL_GAP = 52

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
            return im.crop((0, 0, w, max(1, rows[0] - LABEL_GAP)))
        return im
    return im.crop((0, 0, w, max(1, rows[0] - LABEL_GAP)))


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

    pad = 10
    return im.crop((max(0, left - pad), max(0, top - pad),
                    min(w, right + 1 + pad), min(h, bottom + 1 + pad)))


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
        out = os.path.join(dst, f"{out_name}.png")
        im.save(out, optimize=True)
        kb = os.path.getsize(out) / 1024
        print(f"  {out_name}.png  {before[0]}x{before[1]} -> "
              f"{im.size[0]}x{im.size[1]}  ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
