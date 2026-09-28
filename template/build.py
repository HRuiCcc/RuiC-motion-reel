"""Build a reel: soundtrack, N frames, encode, mux.

    python3 -m <pkg>.build                 full reel
    python3 -m <pkg>.build --at 3:1.2      one full-resolution frame
    python3 -m <pkg>.build --stills 5      review stills from one scene
    python3 -m <pkg>.build --scenes 2,4    re-render only some scenes

Scenes render in parallel, one worker per scene. Each owns its own state and
its own bar, so a worker starting mid-reel is always that scene's first frame.
"""
from __future__ import annotations

import argparse
import multiprocessing as mp
import os
import subprocess
import time

import numpy as np

from mg.core import Canvas

from . import chrome
from . import scenes as SC
from . import theme as T

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out")
FRAMES = os.path.join(OUT, "frames")


def scene_objects():
    # one instance per scene, in bar order: SCENES lives in scenes.py
    return [cls() for cls in SC.SCENES]


def render_one(i, ss=2):
    obj = scene_objects()[i]
    os.makedirs(FRAMES, exist_ok=True)
    f0 = int(round(i * T.BAR * T.FPS))
    f1 = int(round((i + 1) * T.BAR * T.FPS))
    for f in range(f0, f1):
        t = f / T.FPS
        tl = t - i * T.BAR
        c = Canvas(T.W, T.H, ss=ss)
        obj.render(c, tl, t)
        p = c.pass_()
        chrome.draw(p, t, i, chrome.POST[i].get("light", False))
        c.commit()
        chrome.finish(c, t, i)
        c.image().save(os.path.join(FRAMES, f"f{f:04d}.png"))
    return f1 - f0


def render_at(i, tl, ss=2, name=None):
    obj = scene_objects()[i]
    t = i * T.BAR + tl
    c = Canvas(T.W, T.H, ss=ss)
    obj.render(c, tl, t)
    p = c.pass_()
    chrome.draw(p, t, i, chrome.POST[i].get("light", False))
    c.commit()
    chrome.finish(c, t, i)
    path = os.path.join(OUT, name or f"at_s{i}_{tl:.3f}.png")
    c.image().save(path)
    return path


def render_still(i, tl_list, ss=2, tag=""):
    from PIL import Image

    os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
    rows = []
    for k, tl in enumerate(tl_list):
        t = i * T.BAR + tl
        c = Canvas(T.W, T.H, ss=ss)
        scene_objects()[i].render(c, tl, t)
        p = c.pass_()
        chrome.draw(p, t, i, chrome.POST[i].get("light", False))
        c.commit()
        chrome.finish(c, t, i)
        img = c.image()
        img.save(os.path.join(OUT, f"stills/s{i}_{k}_{tl:.2f}{tag}.png"))
        rows.append(img)
    sheet = Image.new("RGB", (rows[0].width, rows[0].height * len(rows)), (0, 0, 0))
    for k, im in enumerate(rows):
        sheet.paste(im, (0, k * im.height))
    sp = os.path.join(OUT, f"sheet_s{i}{tag}.jpg")
    sheet.resize((sheet.width * 3 // 5, sheet.height * 3 // 5), Image.LANCZOS).save(
        sp, quality=88)
    return sp


def build_audio():
    from . import audio as A

    os.makedirs(OUT, exist_ok=True)
    st, sr = A.build()
    A.write_wav(os.path.join(OUT, "track.wav"), st, sr)
    wave, spec = A.analyse(st, sr)
    np.save(os.path.join(OUT, "wave.npy"), wave)
    np.save(os.path.join(OUT, "spec.npy"), spec)
    return os.path.join(OUT, "track.wav")


def encode(name="reel"):
    silent = os.path.join(OUT, f"{name}_silent.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-framerate", str(T.FPS),
        "-i", os.path.join(FRAMES, "f%04d.png"),
        "-c:v", "libx264", "-preset", "slow", "-crf", "16",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent,
    ], check=True)
    final = os.path.join(OUT, f"{name}.mp4")
    wav = os.path.join(OUT, "track.wav")
    if os.path.exists(wav):
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", silent, "-i", wav,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest",
            "-movflags", "+faststart", final,
        ], check=True)
        os.remove(silent)
        return final
    return silent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes", default="all")
    ap.add_argument("--at", default=None)
    ap.add_argument("--stills", type=int, default=None)
    ap.add_argument("--ss", type=int, default=2)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--skip-frames", action="store_true")
    ap.add_argument("--jobs", type=int, default=0)
    args = ap.parse_args()

    if args.at:
        i, tl = args.at.split(":")
        print(render_at(int(i), float(tl), args.ss))
        return
    if args.stills is not None:
        i = args.stills
        print(render_still(i, [T.BAR * (k / 7.0) for k in range(7)], args.ss))
        return

    os.makedirs(OUT, exist_ok=True)
    if not args.no_audio:
        t0 = time.time()
        build_audio()
        print(f"audio  {time.time() - t0:.1f}s")

    idx = list(range(T.BARS)) if args.scenes == "all" else \
        [int(v) for v in args.scenes.split(",")]
    if not args.skip_frames:
        jobs = args.jobs or min(len(idx), max(1, (os.cpu_count() or 4) - 1))
        t0 = time.time()
        with mp.Pool(jobs) as pool:
            counts = pool.starmap(render_one, [(i, args.ss) for i in idx])
        print(f"frames {sum(counts)} in {time.time() - t0:.1f}s ({jobs} workers)")

    print("out:", encode())


if __name__ == "__main__":
    main()
