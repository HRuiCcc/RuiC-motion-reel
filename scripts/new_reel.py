#!/usr/bin/env python3
"""Start a new reel from the template.

    python3 new_reel.py <project_dir> [--name pkg] [--style random|none|<id>] [--force]

Creates a self-contained project:

    <project_dir>/
      assets/fonts/      bundled faces (engine finds these automatically)
      assets/mark.png    placeholder logo for the assembly scene
      <pkg>/             theme.py scenes.py chrome.py audio.py build.py
      mg/                shared engine
      out/               renders land here
      STYLE.md           the drawn style card (`--style none` to skip)

`--name` defaults to a sanitised form of the project directory name.
`--style` draws from the deck by default: the engine defaults to its loudest
look, and a draw keeps a run of films from all being that one film.
"""
from __future__ import annotations

import argparse
import os
import random
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from style_lottery import CARDS, card_markdown, draw   # noqa: E402

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sanitise(name):
    n = re.sub(r"[^0-9a-zA-Z_]", "_", name).strip("_").lower()
    return n if n and not n[0].isdigit() else "reel_" + n


def placeholder_mark(path, size=1024):
    """A hexagonal ring — stands in until the real logo is dropped in."""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    d.regular_polygon((c, c, size * 0.42), 6, rotation=0, fill=(40, 190, 90, 255))
    d.regular_polygon((c, c, size * 0.30), 6, rotation=0, fill=(0, 0, 0, 0))
    d.regular_polygon((c, c, size * 0.13), 6, rotation=0, fill=(40, 190, 90, 255))
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dest")
    ap.add_argument("--name", default=None)
    ap.add_argument("--style", default="random",
                    help="style card id, 'random' (default draw), or 'none'")
    ap.add_argument("--force", action="store_true",
                    help="write into an existing non-empty directory")
    ap.add_argument("--seconds", type=float, default=None,
                    help="film length in seconds (24 -> 12 bars @ 120 BPM)")
    ap.add_argument("--bars", type=int, default=None,
                    help="force a bar count instead of auto-solving it")
    a = ap.parse_args()

    dest = os.path.abspath(os.path.expanduser(a.dest))
    pkg = sanitise(a.name or os.path.basename(dest))

    if os.path.exists(os.path.join(dest, pkg)) and not a.force:
        sys.exit("refusing to overwrite %s (pass --force)" % os.path.join(dest, pkg))

    os.makedirs(os.path.join(dest, "assets", "fonts"), exist_ok=True)
    os.makedirs(os.path.join(dest, "out"), exist_ok=True)

    # engine
    shutil.copytree(os.path.join(SKILL, "engine"), os.path.join(dest, "mg"),
                    dirs_exist_ok=True)
    # package
    shutil.copytree(os.path.join(SKILL, "template"), os.path.join(dest, pkg),
                    dirs_exist_ok=True)
    for junk in ("__pycache__",):
        shutil.rmtree(os.path.join(dest, pkg, junk), ignore_errors=True)
    src = os.path.join(dest, pkg, "build.py")
    # The template ships UTF-8, and its comments have em-dashes in them. Without
    # an explicit encoding, a Chinese Windows console's GBK default can't decode
    # those bytes — and dies mid-copy, leaving a directory that looks installed
    # but still has <pkg> in build.py and no STYLE.md.
    t = open(src, encoding="utf-8").read().replace("<pkg>", pkg)
    open(src, "w", encoding="utf-8").write(t)

    # Film length: rewrite the timeline block so the new project starts at the
    # asked-for duration instead of 15 s. Bars stay one scene each.
    if a.seconds or a.bars:
        tp = os.path.join(dest, pkg, "theme.py")
        tt = open(tp, encoding="utf-8").read()
        if a.bars:
            bars, bpm = a.bars, 240.0 * a.bars / (a.seconds or 15.0)
        else:
            best = None
            for b in range(4, 25):
                v = 240.0 * b / a.seconds
                fpb = a.seconds * 30 / b
                if 60 <= v <= 180 and abs(fpb - round(fpb)) < 1e-6:
                    d = abs(v - 120.0)
                    if best is None or d < best[0]:
                        best = (d, b, v)
            if best is None:
                sys.exit("no clean BPM/bars for %ss — pass --bars" % a.seconds)
            bars, bpm = best[1], best[2]
        text_bpm = ("%.3f" % bpm).rstrip("0").rstrip(".")
        secs = bars * 240.0 / bpm
        tt = re.sub(r"^BARS = \d+$", "BARS = %d" % bars, tt, flags=re.M)
        tt = re.sub(r"^DUR = BAR \* BARS.*$", "DUR = BAR * BARS           # %.3f s" % secs, tt, flags=re.M)
        tt = re.sub(r"^NFRAMES = int\(round\(DUR \* FPS\)\).*$",
                    "NFRAMES = int(round(DUR * FPS))   # %d" % round(secs * 30), tt, flags=re.M)
        tt = re.sub(r"^BPM = [\d.]+$", "BPM = %s" % text_bpm, tt, flags=re.M)
        open(tp, "w", encoding="utf-8").write(tt)
        print("  length      ", "%d bars @ %s BPM = %.3f s"
              % (bars, text_bpm, secs))
    open(os.path.join(dest, pkg, "__init__.py"), "w", encoding="utf-8").close()

    # faces
    fdir = os.path.join(SKILL, "assets", "fonts")
    for f in os.listdir(fdir):
        if f.endswith(".woff"):
            shutil.copy2(os.path.join(fdir, f), os.path.join(dest, "assets", "fonts", f))

    mark = os.path.join(dest, "assets", "mark.png")
    if not os.path.exists(mark):
        placeholder_mark(mark)

    style = None
    if a.style != "none":
        if a.style == "random":
            style = draw(random.Random())
        else:
            style = next((c for c in CARDS if c["id"] == a.style), None)
            if style is None:
                sys.exit("unknown style card %r — see style_lottery.py --list" % a.style)
        with open(os.path.join(dest, "STYLE.md"), "w", encoding="utf-8") as fh:
            fh.write(card_markdown(style))

    print("created", dest)
    print("  package     ", pkg)
    if style is not None:
        print("  style       ", style["id"], "—", style["name"])
        print("                ", style["idiom"])
        if style.get("author_at_delivery"):
            print("                this card wants W, H = OUT_W, OUT_H in theme.py")
    print("  edit        ", os.path.join(pkg, "theme.py"), "(identity, palette, copy)")
    print("  then        ", os.path.join(pkg, "scenes.py"))
    print("  swap logo   ", "assets/mark.png")
    print()
    print("  cd %s" % dest)
    print("  python3 -m %s.build --stills 0   # review scene 01" % pkg)


if __name__ == "__main__":
    main()
