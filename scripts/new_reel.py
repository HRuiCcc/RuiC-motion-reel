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
    t = open(src).read().replace("<pkg>", pkg)
    open(src, "w").write(t)
    open(os.path.join(dest, pkg, "__init__.py"), "w").close()

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
        with open(os.path.join(dest, "STYLE.md"), "w") as fh:
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
