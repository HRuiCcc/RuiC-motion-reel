"""Measure what a GPU would actually buy this engine.

    python3 scripts/perf_probe.py            # the real per-frame op sizes
    python3 scripts/perf_probe.py --full     # also blur the full frame (see below)

Every case mirrors one op the engine runs for a single 1080p frame, at the array
size it really runs at. `--full` adds the one case that would flatter the GPU
enormously — blurring a whole 2x supersampled layer — because the engine never
does that: its blurs all run on the octaves it has already downsampled by 2, 4
and 8. Measuring the full-frame version reports ~72x for the post chain; the
honest figure is ~40x on the ops, which is ~1.45x on the whole frame.

CuPy is optional. Without it the script still reports the CPU side, which is the
number that matters if you are deciding whether to bother.
"""
from __future__ import annotations

import argparse
import time

import numpy as np

W, H = 1920, 1080


def box1d(a, r, axis, xp):
    if r < 1:
        return a
    n = a.shape[axis]
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    ap = xp.pad(a, pad, mode="edge")
    pre = [1 if d == axis else s for d, s in enumerate(ap.shape)]
    c = xp.concatenate([xp.zeros(pre, xp.float32),
                        xp.cumsum(ap, axis=axis, dtype=xp.float32)], axis=axis)
    hi, lo = [slice(None)] * a.ndim, [slice(None)] * a.ndim
    hi[axis] = slice(2 * r + 2, 2 * r + 2 + n)
    lo[axis] = slice(1, 1 + n)
    return (c[tuple(hi)] - c[tuple(lo)]) / float(2 * r + 1)


def blur(a, r, passes, xp):
    for _ in range(passes):
        a = box1d(a, r, 1, xp)
        a = box1d(a, r, 0, xp)
    return a


def bench(fn, cp, n=8):
    fn()
    if cp is not None:
        cp.cuda.Stream.null.synchronize()
    t0 = time.perf_counter()
    for _ in range(n):
        fn()
    if cp is not None:
        cp.cuda.Stream.null.synchronize()
    return (time.perf_counter() - t0) / n * 1000.0


def cases(rng, full=False):
    rgb = rng.random((H, W, 3), np.float32) * 0.5
    addbuf = rng.random((H, W, 3), np.float32) * 0.2
    mask = rng.random((H, W), np.float32)
    la = rng.random((H * 2, W * 2, 1), np.float32)          # ss=2 alpha layer
    lr = rng.random((H * 2, W * 2, 3), np.float32) * 0.5
    o2 = rng.random((H // 2, W // 2, 3), np.float32)        # bright[::2, ::2]
    o4 = rng.random((H // 4, W // 4, 3), np.float32)
    o8 = rng.random((H // 8, W // 8, 3), np.float32)
    mg = (lambda xp: (xp.mgrid[0:H, 0:W][1], xp.mgrid[0:H, 0:W][0]))

    out = [
        ("halation: 3 octaves of blur on 1/2, 1/4, 1/8",
         lambda xp, s: (blur(s[0], 5, 3, xp), blur(s[1], 7, 3, xp), blur(s[2], 6, 3, xp)),
         (o2, o4, o8)),
        ("halation: upsample x2/x4/x8 and accumulate",
         lambda xp, s: (xp.repeat(xp.repeat(s[0], 2, 0), 2, 1) * 0.55
                        + xp.repeat(xp.repeat(s[1], 4, 0), 4, 1)[:H, :W] * 0.30
                        + xp.repeat(xp.repeat(s[2], 8, 0), 8, 1)[:H, :W] * 0.16),
         (o2, o4, o8)),
        ("commit: down2 colour layer 2160x3840x3 -> 1080p",
         lambda xp, s: s.reshape(H, 2, W, 2, 3).mean(axis=(1, 3)), lr),
        ("commit: down2 alpha layer 2160x3840x1 -> 1080p",
         lambda xp, s: s.reshape(H, 2, W, 2, 1).mean(axis=(1, 3)), la),
        ("ink stamp: multiply, 3 passes a frame",
         lambda xp, s: s[0] * (1.0 - s[1][:, :, None] * 0.94) * 3.0, (rgb, mask)),
        ("grain: rng at 1080p + clump blur r1 + mix",
         lambda xp, s: (s[0] + (xp.random.normal(0, 1, (H, W, 1)).astype(xp.float32)
                                * 0.013
                                + blur(xp.random.normal(0, 1, (H, W))
                                       .astype(xp.float32), 1, 1, xp)[:, :, None]
                                * 0.011) * 0.6), rgb),
        ("gate weave: 4 bilinear taps over 2 buffers",
         lambda xp, s: ((xp.roll(s[0], 1, 0) * 0.5 + xp.roll(s[0], -1, 0) * 0.5)
                        + (xp.roll(s[1], 1, 1) * 0.5 + xp.roll(s[1], -1, 1) * 0.5)),
         (rgb, addbuf)),
        ("vignette: mgrid + sqrt + pow + multiply",
         lambda xp, s: s * ((1.0 - 0.06) + 0.06 * xp.clip(
             1.0 - xp.sqrt((mg(xp)[0] - W / 2) ** 2 / (W * 0.74) ** 2
                           + (mg(xp)[1] - H / 2) ** 2 / (H * 0.90) ** 2), 0, 1)
             ** 2.1)[:, :, None], rgb),
        ("environment band: gauss (mgrid + exp + add)",
         lambda xp, s: s + xp.exp(-(((mg(xp)[0] - 900.0) / 620.0) ** 2
                                    + ((mg(xp)[1] - 300.0) / 460.0) ** 2)
                                 )[:, :, None] * 0.075, rgb),
    ]
    if full:
        out.append(("FULL FRAME blur r=5 passes=3 on 2160x3840x3  <-- not a real op",
                    lambda xp, s: blur(s, 5, 3, xp), lr))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true",
                    help="also time the full-frame blur the engine never runs")
    a = ap.parse_args()

    try:
        import cupy as cp
        name = cp.cuda.runtime.getDeviceProperties(0)["name"].decode()
        print("cupy %s on %s" % (cp.__version__, name))
    except Exception as e:                                          # noqa: BLE001
        cp = None
        print("no CuPy (%s) — CPU timings only" % type(e).__name__)

    rng = np.random.default_rng(4)
    print("\n%-58s %9s %9s %7s" % ("op, at the size the engine runs it", "cpu ms",
                                   "gpu ms", "x"))
    tc = tg = 0.0
    for name, fn, s in cases(rng, a.full):
        cpu = bench(lambda: fn(np, s), None)
        if cp is None:
            print("%-58s %9.2f %9s %7s" % (name, cpu, "-", "-"))
            continue
        gs = tuple(cp.asarray(v) for v in (s if isinstance(s, tuple) else (s,)))
        gpu = bench(lambda: fn(cp, gs if isinstance(s, tuple) else gs[0]), cp)
        tc += cpu
        tg += gpu
        print("%-58s %9.2f %9.2f %6.1fx" % (name, cpu, gpu, cpu / max(gpu, 1e-9)))
    if cp is not None:
        print("%-58s %9.2f %9.2f %6.1fx" % ("TOTAL, numpy side of one frame",
                                            tc, tg, tc / max(tg, 1e-9)))
        print("\nthe numpy side is about a third of a 1080p ss=2 frame, so expect"
              "\nroughly 1.45x end to end, not the op-level figure above.")


if __name__ == "__main__":
    main()
