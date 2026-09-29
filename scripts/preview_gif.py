"""Turn a finished reel (or a frame sequence) into a small looping preview GIF.

    python3 scripts/preview_gif.py in.mp4 out.gif
    python3 scripts/preview_gif.py in.mp4 out.gif --start 1.2 --dur 2.5
    python3 scripts/preview_gif.py in.mp4 out.gif --cuts 0.3-1.1,4.4-5.2,9.1-9.9
    python3 scripts/preview_gif.py out/frames out.gif --cuts 190-265

A README preview has one job: read as motion at a glance, in a tile, over a slow
connection. So it is short (2-5 s), small (640 px), and loops. `--cuts` splices
several moments together with hard cuts, which is what you want when the piece's
whole point is that it has six different-looking bars.

Two ffmpeg passes rather than one: the palette is built from the actual selected
frames, so a single strong colour (a red safelight, a green phosphor) does not
get quantised into mud.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit("ffmpeg failed:\n" + (p.stderr or "")[-2000:])
    return p


def parse_cuts(s):
    """'1.2-2.4,7.0-8.1' -> [(1.2, 2.4), (7.0, 8.1)]"""
    out = []
    for part in s.split(","):
        a, _, b = part.strip().partition("-")
        out.append((float(a), float(b)))
    return out


def probe_fps(path, fallback=60.0):
    """Frame rate of the source. Reels ship at 60, but never assume it."""
    p = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", path],
        capture_output=True, text=True)
    if p.returncode != 0:
        return fallback
    num, _, den = p.stdout.strip().partition("/")
    try:
        return float(num) / float(den or 1) or fallback
    except ValueError:
        return fallback


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="an mp4, or a directory of f%%04d.png")
    ap.add_argument("dst")
    ap.add_argument("--start", type=float, default=None)
    ap.add_argument("--dur", type=float, default=None)
    ap.add_argument("--cuts", default=None,
                    help="splice several spans, e.g. 0.3-1.1,4.4-5.2")
    ap.add_argument("--w", type=int, default=640)
    ap.add_argument("--fps", type=int, default=14)
    ap.add_argument("--in-fps", type=float, default=30.0,
                    help="frame rate of a PNG-sequence source; an mp4 is probed "
                         "instead. Delivery is 30 fps, the reel's own FPS wins")
    ap.add_argument("--colors", type=int, default=224)
    ap.add_argument("--dither", default="sierra2_4a",
                    help="sierra2_4a | bayer:bayer_scale=N | none. Grainy footage "
                         "already dithers itself, so none is both smaller and fine")
    args = ap.parse_args()

    is_dir = os.path.isdir(args.src)
    if is_dir:
        fps_in = float(args.in_fps)
        src = ["-framerate", "%g" % fps_in, "-i", os.path.join(args.src, "f%04d.png")]
    else:
        fps_in = probe_fps(args.src, args.in_fps)
        src = ["-i", args.src]

    if args.cuts:
        cuts = parse_cuts(args.cuts)
    else:
        s = 0.0 if args.start is None else args.start
        d = 2.5 if args.dur is None else args.dur
        cuts = [(s, s + d)]

    tmp = tempfile.mkdtemp(prefix="gif_")
    try:
        # pass 1: pull the chosen spans out as PNGs, in order
        n = 0
        for k, (a, b) in enumerate(cuts):
            seg = os.path.join(tmp, "seg%02d" % k)
            os.makedirs(seg)
            run(["ffmpeg", "-y", "-v", "error"] + src +
                ["-ss", "%.4f" % a, "-t", "%.4f" % (b - a),
                 os.path.join(seg, "f%04d.png")])
            got = sorted(f for f in os.listdir(seg) if f.endswith(".png"))
            if not got:
                sys.exit("no frames in span %.2f-%.2f" % (a, b))
            for f in got:
                shutil.move(os.path.join(seg, f), os.path.join(tmp, "f%04d.png" % n))
                n += 1
        if n < 4:
            sys.exit("only %d frames selected" % n)

        # pass 2: fps + scale + a palette built from these frames
        vf = ("fps=%d,scale=%d:-2:flags=lanczos,split[a][b];"
              "[a]palettegen=max_colors=%d:stats_mode=diff[p];"
              "[b][p]paletteuse=dither=%s:diff_mode=rectangle"
              % (args.fps, args.w, args.colors, args.dither))
        run(["ffmpeg", "-y", "-v", "error", "-framerate", "30",
             "-i", os.path.join(tmp, "f%04d.png"),
             "-vf", vf, "-loop", "0", args.dst])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    kb = os.path.getsize(args.dst) / 1024.0
    print("%-46s %6.0f KB  %.2f s  %d px wide"
          % (args.dst, kb, n / fps_in, args.w))
    if kb > 3000:
        print("  ^ over 3 MB — lower --fps, --w or --colors; GitHub renders it "
              "inline and a heavy GIF is a slow README")


if __name__ == "__main__":
    main()
