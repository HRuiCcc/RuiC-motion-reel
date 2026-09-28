"""Render core: a small compositing engine built for this reel.

Pipeline per frame:
    Canvas.clear()          -> base plate (float RGB, 0..1)
    Canvas.fade()           -> trail persistence
    Canvas.light()          -> direct numpy additive paint (particles, bars)
    Canvas.pass_() / commit -> PIL vector+type pass at SS resolution, box-downsampled
    Canvas.post()           -> bloom, chromatic aberration, grain, vignette, tonemap
    Canvas.image()          -> PIL frame

Everything upstream of `post()` is display-referred sRGB floats; bloom is applied
as additive light, which is the look the reference reel has.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from . import fonts as F


# --------------------------------------------------------------------------
# numeric helpers
# --------------------------------------------------------------------------
def clip01(a):
    return np.clip(a, 0.0, 1.0)


def rgb01(color):
    c = np.asarray(color, np.float32).reshape(-1)[:3]
    return c / 255.0 if c.max() > 1.5 else c


def down2(a):
    """Exact 2x box downsample, any trailing channel count."""
    h, w = a.shape[0], a.shape[1]
    return a.reshape(h // 2, 2, w // 2, 2, *a.shape[2:]).mean(axis=(1, 3))


def _box1d(a, r, axis):
    if r < 1:
        return a
    n = a.shape[axis]
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    ap = np.pad(a, pad, mode="edge")
    pre = [1 if d == axis else s for d, s in enumerate(ap.shape)]
    c = np.concatenate(
        [np.zeros(pre, np.float32), np.cumsum(ap, axis=axis, dtype=np.float32)], axis=axis
    )
    hi, lo = [slice(None)] * a.ndim, [slice(None)] * a.ndim
    hi[axis] = slice(2 * r + 2, 2 * r + 2 + n)
    lo[axis] = slice(1, 1 + n)
    return (c[tuple(hi)] - c[tuple(lo)]) / float(2 * r + 1)


def blur(a, r, passes=3):
    """Separable box blur run `passes` times — a good Gaussian stand-in."""
    for _ in range(passes):
        a = _box1d(a, r, 1)
        a = _box1d(a, r, 0)
    return a


def smoothstep(e0, e1, x):
    t = clip01((np.asarray(x, np.float32) - e0) / max(1e-6, e1 - e0))
    return t * t * (3 - 2 * t)


def radial(w, h, cx, cy, rx, ry=None, power=2.0):
    """Normalised radial falloff, 1.0 at centre -> 0.0 at the edge."""
    ry = ry if ry is not None else rx
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return clip01(1.0 - d) ** power


_BITMAPS = {}


def _load_bitmap(src):
    """Load (and cache) an RGBA bitmap from a path or PIL image."""
    from PIL import Image as _I
    if isinstance(src, str):
        key = src
        im = _BITMAPS.get(key)
        if im is None:
            im = _I.open(src).convert("RGBA")
            _BITMAPS[key] = im
        return im
    return src.convert("RGBA")


def shift2(a, off):
    """Translate an (h, w[, c]) field by (dx, dy) px, edge-clamped."""
    dx, dy = int(round(off[0])), int(round(off[1]))
    if dx == 0 and dy == 0:
        return a
    out = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
    if dy > 0:
        out[:dy] = out[dy:dy + 1]
    elif dy < 0:
        out[dy:] = out[dy - 1:dy]
    if dx > 0:
        out[:, :dx] = out[:, dx:dx + 1]
    elif dx < 0:
        out[:, dx:] = out[:, dx - 1:dx]
    return out


def fiber_field(w, h, seed=5):
    """Paper fibre: noise stretched hard along both axes, then combined.

    Real paper is a mat of long thin fibres, so an anisotropically blurred noise
    field reads far more like stock than white noise does.
    """
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (h, w)).astype(np.float32)
    hor = _box1d(_box1d(n, 9, 1), 1, 0)
    ver = _box1d(_box1d(n, 9, 0), 1, 1)
    f = (hor + ver) * 0.5
    return f / (np.abs(f).max() + 1e-6)


def paper_field(w, h, base=(243, 238, 229), seed=11, tooth=0.020, mottle=0.016,
                fibre=0.012, warm=(1.0, 0.985, 0.955)):
    """A sheet of uncoated stock: mottling, tooth and fibre over a warm base."""
    rng = np.random.default_rng(seed)
    b = np.asarray(base, np.float32) / 255.0
    # low-frequency blotching, as if the pulp is uneven
    coarse = rng.normal(0, 1, (h // 10 + 2, w // 10 + 2)).astype(np.float32)
    coarse = blur(np.repeat(np.repeat(coarse, 10, 0), 10, 1)[:h, :w], 5, 2)
    coarse /= np.abs(coarse).max() + 1e-6
    fine = rng.normal(0, 1, (h, w)).astype(np.float32)
    fib = fiber_field(w, h, seed + 7)
    m = (1.0 + mottle * coarse + tooth * fine + fibre * fib)[..., None]
    return clip01(b.reshape(1, 1, 3) * np.asarray(warm, np.float32).reshape(1, 1, 3) * m)


def ink_coverage(w, h, seed=3, amount=0.22, scale=14):
    """Uneven ink deposition: coverage dips where the paper is low.

    Used as a multiplier on deposited ink so flat areas are never perfectly
    flat, which is the single biggest tell between a print and a fill.
    """
    rng = np.random.default_rng(seed)
    c = rng.normal(0, 1, (h // int(scale) + 2, w // int(scale) + 2)).astype(np.float32)
    c = np.repeat(np.repeat(c, int(scale), 0), int(scale), 1)[:h, :w]
    c = blur(c, 3, 2)
    c /= np.abs(c).max() + 1e-6
    grain = rng.normal(0, 1, (h, w)).astype(np.float32)
    v = 1.0 - amount * (0.5 + 0.5 * c) * 0.5 - amount * 0.35 * np.abs(grain) * 0.5
    return clip01(v)[..., None]


def halftone(field, cell=8.0, angle=15.0, soft=0.5):
    """Antialiased halftone screen: dot area tracks `field` (0..1).

    Dots sit on a rotated lattice so the screen angle can be set per ink, the
    way a real separator would to avoid moire between plates.
    """
    h, w = field.shape[:2]
    a = np.radians(angle)
    ca, sa = np.cos(a), np.sin(a)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx * ca + yy * sa) / cell
    v = (-xx * sa + yy * ca) / cell
    fu = u - np.floor(u) - 0.5
    fv = v - np.floor(v) - 0.5
    r = np.sqrt(fu * fu + fv * fv) / 0.5        # 0 at dot centre, 1 at cell corner
    rad = np.sqrt(clip01(field))
    return clip01((rad - r) / max(1e-3, soft) + 0.5)


def gauss(w, h, cx, cy, rx, ry):
    """2D Gaussian field — soft band/blob light for background plates."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))


def hgrad(w, left, right):
    """Horizontal 1px-tall gradient row, shape (1, w, 3)."""
    t = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    a = np.asarray(left, np.float32).reshape(1, 1, 3) / 255.0
    b = np.asarray(right, np.float32).reshape(1, 1, 3) / 255.0
    return a + (b - a) * t


def vgrad(h, top, bot):
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    a = np.asarray(top, np.float32).reshape(1, 1, 3) / 255.0
    b = np.asarray(bot, np.float32).reshape(1, 1, 3) / 255.0
    return a + (b - a) * t


# --------------------------------------------------------------------------
# Canvas
# --------------------------------------------------------------------------
class Canvas:
    def __init__(self, w, h, ss=2):
        self.w, self.h, self.ss = w, h, ss
        self.sw, self.sh = w * ss, h * ss
        self.rgb = np.zeros((h, w, 3), np.float32)
        self.add = np.zeros((h, w, 3), np.float32)
        self._pass = None
        # a scene can override the per-scene finishing for individual beats
        # (the white CUT frame must not bloom its own dark type away)
        self.post_override = {}
        # print-shop state: ink sits unevenly on paper, and every plate is a
        # fraction of a millimetre off register. Both apply to every ink commit.
        self.coverage = None      # (h, w, 1) multiplier on deposited ink
        self.soften = 0.0         # px of ink-edge softening (absorption)
        self.misreg = (0.0, 0.0)  # plate offset in px

    # -- plate ------------------------------------------------------------
    def clear(self, color):
        self.rgb[:] = rgb01(color).reshape(1, 1, 3)
        self.add[:] = 0.0

    def fade(self, k):
        self.rgb *= k

    def light(self, arr, k=1.0):
        self.add += arr * k

    def composite(self, lrgb, la, mode="normal"):
        la = np.clip(la, 0.0, 1.0)
        if mode == "normal":
            self.rgb = self.rgb * (1.0 - la) + lrgb * la
        elif mode == "add":
            self.add += lrgb * la
        elif mode == "screen":
            self.rgb = clip01(1.0 - (1.0 - self.rgb) * (1.0 - np.clip(lrgb * la, 0, 1)))
        elif mode == "multiply":
            # Translucent ink over ink. This is what makes an overprint read as
            # a new colour (pink over blue becomes purple) instead of as stacking.
            self.rgb = self.rgb * (1.0 - la * (1.0 - lrgb))
        elif mode == "replace":
            self.rgb = self.rgb * (1.0 - la) + lrgb

    def _ink_treat(self, la, coverage=None, soften=None, misreg=None):
        cov = self.coverage if coverage is None else coverage
        if cov is not None:
            la = la * cov
        s = self.soften if soften is None else soften
        if s > 0:
            la = blur(la, max(1, int(round(s))), 1)
        m = self.misreg if misreg is None else misreg
        if m and (m[0] or m[1]):
            la = shift2(la, m)
        return la

    def stamp(self, mask, color, mode="multiply", alpha=1.0, coverage=None,
              soften=None, misreg=None):
        """Deposit flat ink through a numpy coverage mask."""
        la = np.clip(np.asarray(mask, np.float32), 0.0, 1.0)
        if la.ndim == 2:
            la = la[..., None]
        la = la * alpha
        la = self._ink_treat(la, coverage, soften, misreg)
        lrgb = np.broadcast_to(rgb01(color).reshape(1, 1, 3), (self.h, self.w, 3))
        self.composite(lrgb, la, mode)

    # -- bitmap -----------------------------------------------------------
    def blit(self, img, cx, cy, scale=1.0, alpha=1.0, tint=None,
             mode="normal", rotate=0.0, glow=0.0):
        """Composite an RGBA bitmap (a logo) centred on (cx, cy).

        `tint` replaces the bitmap's colour with a flat one, keeping its alpha —
        the usual way a single-colour mark is placed on a coloured plate.
        """
        im = _load_bitmap(img)
        if rotate:
            im = im.rotate(rotate, resample=Image.BICUBIC, expand=True)
        w = max(1, int(round(im.width * scale)))
        h = max(1, int(round(im.height * scale)))
        arr = np.asarray(im.resize((w, h), Image.LANCZOS), np.float32) / 255.0
        if tint is not None:
            arr[..., :3] = np.asarray(rgb01(tint), np.float32).reshape(1, 1, 3)
        la = arr[..., 3:4] * alpha
        x0, y0 = int(round(cx - w / 2.0)), int(round(cy - h / 2.0))
        sx0, sy0 = max(0, -x0), max(0, -y0)
        dx0, dy0 = max(0, x0), max(0, y0)
        cw = min(w - sx0, self.w - dx0)
        ch = min(h - sy0, self.h - dy0)
        if cw <= 0 or ch <= 0:
            return
        sub = arr[sy0:sy0 + ch, sx0:sx0 + cw, :3]
        suba = la[sy0:sy0 + ch, sx0:sx0 + cw]
        if glow > 0 and mode == "add":
            self.add[dy0:dy0 + ch, dx0:dx0 + cw] += sub * suba * glow
        region = (slice(dy0, dy0 + ch), slice(dx0, dx0 + cw))
        if mode == "add":
            self.add[region] += sub * suba * (1.0 if glow <= 0 else 1.0)
        else:
            cur = self.rgb[region]
            self.rgb[region] = cur * (1.0 - suba) + sub * suba

    # -- vector pass ------------------------------------------------------
    def pass_(self):
        self._pass = _Pass(self.sw, self.sh, self.ss)
        return self._pass

    def commit(self, mode="normal", coverage=None, soften=None, misreg=None):
        p, self._pass = self._pass, None
        if p is None:
            return
        arr = np.asarray(p.layer, np.float32) / 255.0
        if self.ss > 1:
            lrgb, la = down2(arr[..., :3]), down2(arr[..., 3:4])
        else:
            lrgb, la = arr[..., :3], arr[..., 3:4]
        lrgb = np.clip(lrgb, 0.0, 1.0)
        # additive passes are light, not ink — the print-shop treatment only
        # applies to ink laid onto paper
        if mode in ("normal", "multiply"):
            la = self._ink_treat(la, coverage, soften, misreg)
        self.composite(lrgb, la, mode)

    # -- effects ----------------------------------------------------------
    def glow(self, color, cx, cy, rx, ry=None, power=2.4, gain=1.0):
        f = radial(self.w, self.h, cx, cy, rx, ry, power)[..., None]
        self.add += f * rgb01(color).reshape(1, 1, 3) * gain

    def bloom(self, thr=0.68, knee=0.26, octaves=((2, 4, 0.30), (4, 6, 0.20), (8, 5, 0.11))):
        src = clip01(self.rgb + self.add)
        lum = src.max(axis=2, keepdims=True)
        bright = src * clip01((lum - thr) / max(1e-5, knee))
        out = np.zeros_like(src)
        for fac, rad, amt in octaves:
            small = bright[::fac, ::fac]
            up = np.repeat(np.repeat(blur(small, rad, 3), fac, axis=0), fac, axis=1)
            out += up[: self.h, : self.w] * amt
        self.add += out

    def chroma(self, px=1.6):
        if px <= 0:
            return
        img = clip01(self.rgb + self.add)
        yy, xx = np.mgrid[0 : self.h, 0 : self.w]
        dx = (xx - self.w / 2) / (self.w / 2)
        dy = (yy - self.h / 2) / (self.h / 2)
        sx = np.clip(np.round(xx + dx * px).astype(int), 0, self.w - 1)
        sy = np.clip(np.round(yy + dy * px).astype(int), 0, self.h - 1)
        bx = np.clip(np.round(xx - dx * px).astype(int), 0, self.w - 1)
        by = np.clip(np.round(yy - dy * px).astype(int), 0, self.h - 1)
        out = np.stack([img[sy, sx, 0], img[yy, xx, 1], img[by, bx, 2]], -1)
        self.add *= 0.0
        self.rgb = out

    def vignette(self, amount=0.55, power=1.6):
        f = radial(self.w, self.h, self.w / 2, self.h / 2, self.w * 0.74, self.h * 0.90, power)
        self.rgb *= (1.0 - amount) + amount * f[..., None]

    def scanlines(self, amount=0.018, period=3):
        y = np.arange(self.h, dtype=np.float32)[:, None, None]
        self.rgb *= 1.0 - amount * (1.0 + np.cos(2 * np.pi * y / period)) * 0.5

    def grain(self, amount=0.030, rng=None):
        rng = rng or np.random.default_rng()
        n = rng.normal(0, 1, (self.h, self.w, 1)).astype(np.float32)
        self.rgb = clip01(self.rgb + n * amount * (0.30 + 0.70 * (1.0 - self.rgb)))

    def grade(self, lift=(0.004, 0.008, 0.018), gain=(1.0, 1.0, 1.03), sat=1.06):
        self.rgb = self.rgb * np.asarray(gain, np.float32).reshape(1, 1, 3) + np.asarray(
            lift, np.float32
        ).reshape(1, 1, 3)
        l = self.rgb.mean(axis=2, keepdims=True)
        self.rgb = clip01(l + (self.rgb - l) * sat)

    def tonemap(self, knee=0.80):
        """Shoulder above `knee` — additive light rolls off instead of clipping.

        Identity below the knee, so the plate and everything drawn on it keeps
        its literal value; only the accumulated glow is compressed. Whites land
        near 0.95 rather than flat 1.0, which reads as film rather than paper.
        """
        x = self.rgb + self.add
        k = knee
        over = k + (1.0 - k) * np.tanh(np.maximum(x - k, 0.0) / max(1e-6, 1.0 - k))
        self.rgb = clip01(np.where(x <= k, x, over))
        self.add *= 0.0

    def image(self):
        """Output is display-referred end to end — no linear->sRGB encode.

        Values were authored as sRGB from the start (ink #05080D is 5/8/13), so
        encoding again would lift every dark by ~2.5x against the reference.
        """
        a = clip01(self.rgb)
        return Image.fromarray((a * 255.0 + 0.5).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------
# vector pass (PIL, supersampled)
# --------------------------------------------------------------------------
class _Pass:
    """Vector + type drawing onto a transparent RGBA layer.

    PIL both replaces pixels instead of blending and skips antialiasing, so each
    element is rasterised as an opaque coverage mask and composited as a unit.
    Committing box-downsamples the layer, which is where the AA comes from.
    """

    def __init__(self, sw, sh, ss):
        self.sw, self.sh, self.ss = sw, sh, ss
        self.layer = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        self._m = Image.new("L", (sw, sh), 0)
        self._dm = ImageDraw.Draw(self._m)
        self._dirty = None
        self._clip = None
        self._stack = []

    # -- transform --------------------------------------------------------
    def push(self, dx=0.0, dy=0.0, rot=0.0, scale=1.0, ax=0.0, ay=0.0):
        self._stack.append((dx, dy, rot, scale, ax, ay))

    def pop(self):
        self._stack.pop()

    def _xf(self, x, y):
        for dx, dy, rot, sc, ax, ay in self._stack:
            x, y = (x - ax) * sc, (y - ay) * sc
            if rot:
                c, s = np.cos(rot), np.sin(rot)
                x, y = x * c - y * s, x * s + y * c
            x, y = x + ax + dx, y + ay + dy
        return x, y

    def _pts(self, pts):
        if not self._stack:
            return [(x * self.ss, y * self.ss) for x, y in pts]
        return [tuple(v * self.ss for v in self._xf(x, y)) for x, y in pts]

    def _pt(self, x, y):
        if not self._stack:
            return x * self.ss, y * self.ss
        px, py = self._xf(x, y)
        return px * self.ss, py * self.ss

    # -- compositing ------------------------------------------------------
    def _clear(self):
        """Clear only what the previous element touched."""
        if self._dirty is None:
            self._dm.rectangle([0, 0, self.sw, self.sh], fill=0)
        else:
            x0, y0, x1, y1 = self._dirty
            self._dm.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=0)
        self._dirty = None

    def _alpha_pt(self, a):
        if a >= 0.999:
            return self._m
        return self._m.point(lambda v: v * a // 255)

    def _stamp(self, color, alpha=1.0):
        if alpha <= 0.002:
            return
        self._apply_clip()
        self._dirty = self._m.getbbox()
        if not self._dirty:
            return
        c = tuple(int(round(v)) for v in np.asarray(rgb01(color) * 255.0, np.float32))
        m = self._m.crop(self._dirty)
        if alpha < 0.999:
            m = m.point(lambda v: int(v * alpha))
        sol = Image.new("RGBA", m.size, c + (255,))
        sol.putalpha(m)
        self.layer.alpha_composite(sol, (self._dirty[0], self._dirty[1]))

    def _stamp_grad(self, top, bot, alpha=1.0, horizontal=False):
        if alpha <= 0.002:
            return
        self._apply_clip()
        self._dirty = self._m.getbbox()
        if not self._dirty:
            return
        x0, y0, x1, y1 = self._dirty
        m = self._m.crop(self._dirty)
        if alpha < 0.999:
            m = m.point(lambda v: int(v * alpha))
        h, w = m.size[1], m.size[0]
        if horizontal:
            t = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
        else:
            t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
        a = np.asarray(rgb01(top), np.float32).reshape(1, 1, 3)
        b = np.asarray(rgb01(bot), np.float32).reshape(1, 1, 3)
        grad = np.repeat(a + (b - a) * t, w, axis=1) if not horizontal else np.repeat(a + (b - a) * t, h, axis=0)
        sol = Image.fromarray((clip01(grad) * 255).astype(np.uint8), "RGB").convert("RGBA")
        sol.putalpha(m)
        self.layer.alpha_composite(sol, (x0, y0))

    def _fill(self, color=None, grad=None, alpha=1.0, horizontal=False):
        if grad:
            self._stamp_grad(grad[0], grad[1], alpha, horizontal)
        else:
            self._stamp(color, alpha)

    # -- primitives -------------------------------------------------------
    def rect(self, x, y, w, h, color=None, alpha=1.0, grad=None, radius=0, horizontal=False):
        self._clear()
        (x0, y0), (x1, y1) = self._pts([(x, y), (x + w, y + h)])
        if radius:
            self._dm.rounded_rectangle([x0, y0, x1, y1], radius * self.ss, fill=255)
        else:
            self._dm.rectangle([x0, y0, x1, y1], fill=255)
        self._fill(color, grad, alpha, horizontal)

    def poly(self, pts, color=None, alpha=1.0, grad=None, horizontal=False):
        self._clear()
        self._dm.polygon(self._pts(pts), fill=255)
        self._fill(color, grad, alpha, horizontal)

    def line(self, pts, color=None, width=1.0, alpha=1.0, cap=True, grad=None):
        self._clear()
        p = self._pts(pts)
        wpx = max(1, int(round(width * self.ss)))
        self._dm.line(p, fill=255, width=wpx, joint="curve")
        if cap and wpx > 2:
            r = wpx / 2.0
            for px, py in (p[0], p[-1]):
                self._dm.ellipse([px - r, py - r, px + r, py + r], fill=255)
        self._fill(color, grad, alpha)

    def path(self, pts, color=None, width=1.0, alpha=1.0, grad=None, closed=False):
        """Polyline through many points, no round caps (cheap for curves)."""
        self._clear()
        p = self._pts(pts)
        if closed:
            p = p + [p[0]]
        self._dm.line(p, fill=255, width=max(1, int(round(width * self.ss))), joint="curve")
        self._fill(color, grad, alpha)

    def ellipse(self, cx, cy, rx, ry, color=None, alpha=1.0, grad=None, width=0.0):
        self._clear()
        (x0, y0), (x1, y1) = self._pts([(cx - rx, cy - ry), (cx + rx, cy + ry)])
        wpx = int(round(width * self.ss))
        if wpx > 0:
            self._dm.ellipse([x0, y0, x1, y1], outline=255, width=wpx)
        else:
            self._dm.ellipse([x0, y0, x1, y1], fill=255)
        self._fill(color, grad, alpha)

    def arc(self, cx, cy, rx, ry, a0, a1, color, width=2.0, alpha=1.0):
        self._clear()
        (x0, y0), (x1, y1) = self._pts([(cx - rx, cy - ry), (cx + rx, cy + ry)])
        self._dm.arc([x0, y0, x1, y1], a0, a1, fill=255, width=max(1, int(round(width * self.ss))))
        self._stamp(color, alpha)

    def dots(self, xy, r, color, alpha=1.0):
        """Batch of same-radius points — point clouds, star fields."""
        self._clear()
        d = self._dm
        rr = r * self.ss
        for x, y in xy:
            px, py = self._pt(x, y)
            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=255)
        self._stamp(color, alpha)

    def dot(self, x, y, r, color=None, alpha=1.0, grad=None):
        self._clear()
        px, py = self._pt(x, y)
        rr = r * self.ss
        self._dm.ellipse([px - rr, py - rr, px + rr, py + rr], fill=255)
        self._fill(color, grad, alpha)

    # -- type -------------------------------------------------------------
    def text(self, x, y, s, f, color=None, track=0.0, anchor="ls", alpha=1.0,
             grad=None, horizontal=False):
        """Draw `s` with origin (x, y).

        anchor: [l|m|r] horizontal, [s|t|m|b] vertical (s = baseline,
        t = cap top, m = cap middle, b = descent line).
        `track` adds uniform tracking on top of the font's own kerning.
        Returns the advance width so labels can be chained.
        """
        if not s:
            return 0.0
        ss = self.ss
        wdt = F.measure(f, s, track)          # resolved in canvas px
        if anchor[0] == "m":
            x -= wdt / 2.0
        elif anchor[0] == "r":
            x -= wdt
        if anchor[1] == "t":
            y = F.baseline_for_cap_top(f, y)
        elif anchor[1] == "m":
            y = F.baseline_for_cap_centre(f, y)
        elif anchor[1] == "b":
            y -= f.getmetrics()[1]
        px, py = self._xf(x, y)
        sf = F.scaled(f, ss)
        self._clear()
        d = self._dm
        if track == 0.0:
            d.text((px * ss, py * ss), s, font=sf, fill=255, anchor="ls")
        else:
            for ch, ox in zip(s, F.kerned_layout(sf, s, track * ss)):
                d.text((px * ss + ox, py * ss), ch, font=sf, fill=255, anchor="ls")
        self._fill(color, grad, alpha, horizontal)
        return wdt

    def _text_mask(self, x, y, s, f, track):
        """Render `s` to a scratch mask and return it (canvas-px origin resolved).

        Shared by the sliced and outlined variants. Coordinates come back in
        supersampled space so callers can crop/subtract directly.
        """
        ss = self.ss
        wdt = F.measure(f, s, track)
        px, py = x, y
        sf = F.scaled(f, ss)
        tmp = Image.new("L", (self.sw, self.sh), 0)
        td = ImageDraw.Draw(tmp)
        if track == 0.0:
            td.text((px * ss, py * ss), s, font=sf, fill=255, anchor="ls")
        else:
            for ch, ox in zip(s, F.kerned_layout(sf, s, track * ss)):
                td.text((px * ss + ox, py * ss), ch, font=sf, fill=255, anchor="ls")
        return tmp, wdt

    def text_slices(self, x, y, s, f, color=None, track=0.0, n=8, offsets=None,
                    alpha=1.0, grad=None, anchor="ls"):
        """Draw `s` cut into `n` horizontal bands, each shifted by offsets[i].

        This is the mechanical glitch/slice language: the word stays readable
        while its own scanlines tear sideways.
        """
        if offsets is None:
            return 0.0
        wdt = F.measure(f, s, track)
        if anchor[0] == "m":
            x -= wdt / 2.0
        elif anchor[0] == "r":
            x -= wdt
        if anchor[1] == "t":
            y = F.baseline_for_cap_top(f, y)
        elif anchor[1] == "m":
            y = F.baseline_for_cap_centre(f, y)
        elif anchor[1] == "b":
            y -= f.getmetrics()[1]
        tmp, _w = self._text_mask(x, y, s, f, track)
        bb = tmp.getbbox()
        if not bb:
            return wdt
        self._clear()
        y0, y1 = bb[1], bb[3]
        step = (y1 - y0) / float(n)
        lo, hi = min(offsets[:n]), max(offsets[:n])
        for i in range(n):
            a = int(y0 + step * i)
            b = int(y0 + step * (i + 1))
            if b <= a:
                continue
            band = tmp.crop((0, a, self.sw, b))
            if not band.getbbox():
                continue
            self._m.paste(band, (int(round(offsets[i] * self.ss)), a))
        self._dirty = (
            max(0, int(bb[0] + lo * self.ss)),
            bb[1],
            min(self.sw, int(bb[2] + hi * self.ss)),
            bb[3],
        )
        self._apply_clip()
        self._fill(color, grad, alpha)
        return wdt

    def text_outline(self, x, y, s, f, color, track=0.0, width=1.6, alpha=1.0):
        """Stroke-only text: outer mask minus a copy eroded by `width`.

        Erosion runs on the crop around the glyphs, not the full supersampled
        frame — a MinFilter over 3.7M pixels per call is the difference between
        a few milliseconds and a few seconds per frame.
        """
        tmp, wdt = self._text_mask(x, y, s, f, track)
        bb = tmp.getbbox()
        if not bb:
            return wdt
        r = max(1, int(round(width * self.ss)))
        pad = r + 2
        cx0, cy0 = max(0, bb[0] - pad), max(0, bb[1] - pad)
        cx1, cy1 = min(self.sw, bb[2] + pad), min(self.sh, bb[3] + pad)
        sub = tmp.crop((cx0, cy0, cx1, cy1))
        ring = ImageChops.subtract(sub, sub.filter(ImageFilter.MinFilter(r * 2 + 1)))
        rb = ring.getbbox()
        if not rb:
            return wdt
        self._clear()
        px, py = cx0 + rb[0], cy0 + rb[1]
        self._m.paste(ring.crop(rb), (px, py))
        self._dirty = (px, py, cx0 + rb[2], cy0 + rb[3])
        self._stamp(color, alpha)
        return wdt

    def text_scaled(self, x, y, s, f, color, track=0.0, sx=1.0, sy=1.0,
                    anchor="ls", alpha=1.0, grad=None):
        """True anisotropic scaling of the glyphs about the anchor point.

        Push/pop only moves a text origin — glyph bitmaps are drawn at their
        font size — so squash/stretch has to happen on the rasterised mask.
        """
        ss = self.ss
        wdt = F.measure(f, s, track)
        w0 = wdt
        if anchor[0] == "m":
            x -= w0 / 2.0
        elif anchor[0] == "r":
            x -= w0
        if anchor[1] == "t":
            y = F.baseline_for_cap_top(f, y)
        elif anchor[1] == "m":
            y = F.baseline_for_cap_centre(f, y)
        elif anchor[1] == "b":
            y -= f.getmetrics()[1]
        tmp, _ = self._text_mask(x, y, s, f, track)
        bb = tmp.getbbox()
        if not bb:
            return wdt
        sub = tmp.crop(bb)
        # fixed point, in the source bbox's local coordinates
        ct, cb = F.cap_metrics(f)
        if anchor[0] == "m":
            axl = (x + w0 / 2.0) * ss - bb[0]
        elif anchor[0] == "r":
            axl = (x + w0) * ss - bb[0]
        else:
            axl = x * ss - bb[0]
        ayl = (y + (ct + cb) / 2.0) * ss - bb[1]
        nw = max(1, int(round(sub.width * sx)))
        nh = max(1, int(round(sub.height * sy)))
        sub = sub.resize((nw, nh), Image.BILINEAR)
        px = bb[0] + axl - axl * sx
        py = bb[1] + ayl - ayl * sy
        self._clear()
        self._m.paste(sub, (int(round(px)), int(round(py))))
        self._dirty = self._m.getbbox()
        self._fill(color, grad, alpha)
        return wdt

    # -- clipping ---------------------------------------------------------
    def clip(self, x0, y0, x1, y1):
        """Restrict subsequent draws to a rect (canvas px). Nesting is flat."""
        self._clip = (x0 * self.ss, y0 * self.ss, x1 * self.ss, y1 * self.ss)

    def unclip(self):
        self._clip = None

    def _apply_clip(self):
        if not self._clip:
            return
        x0, y0, x1, y1 = self._clip
        x0, y0 = max(0.0, x0), max(0.0, y0)
        x1, y1 = min(float(self.sw), x1), min(float(self.sh), y1)
        blk = (0, 0, 0, 0)
        self._m.paste(0, (0, 0, self.sw, int(y0)))
        self._m.paste(0, (0, int(y1), self.sw, self.sh))
        self._m.paste(0, (0, int(y0), int(x0), int(y1)))
        self._m.paste(0, (int(x1), int(y0), self.sw, int(y1)))

    def text_bounds(self, x, y, s, f, track=0.0):
        """Inked bbox of `s` in canvas px, for hugging annotations to type."""
        tmp, wdt = self._text_mask(x, y, s, f, track)
        bb = tmp.getbbox()
        if not bb:
            return (x, y, x, y)
        return (bb[0] / self.ss, bb[1] / self.ss, bb[2] / self.ss, bb[3] / self.ss)


# --------------------------------------------------------------------------
# frame-wide overlays (the reel's shared HUD chrome)
# --------------------------------------------------------------------------
def corner_brackets(p, w, h, color, m=26.0, ln=16.0, alpha=0.5, width=1.0):
    for cx, cy, sx, sy in ((m, m, 1, 1), (w - m, m, -1, 1), (m, h - m, 1, -1), (w - m, h - m, -1, -1)):
        p.line([(cx, cy), (cx + sx * ln, cy)], color, width, alpha)
        p.line([(cx, cy), (cx, cy + sy * ln)], color, width, alpha)


def grid_overlay(p, w, h, color, cols=12, rows=7, alpha=0.05, width=0.8, inset=0.0):
    for i in range(1, cols):
        x = inset + (w - 2 * inset) * i / cols
        p.line([(x, inset), (x, h - inset)], color, width, alpha)
    for j in range(1, rows):
        y = inset + (h - 2 * inset) * j / rows
        p.line([(inset, y), (w - inset, y)], color, width, alpha)


def ticks(p, x0, x1, y, color, n=48, major=8, ln=5.0, alpha=0.5, width=1.0, up=True):
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        L = ln if i % major == 0 else ln * 0.45
        p.line([(x, y), (x, y - L if up else y + L)], color, width, alpha)


def dim_line(p, x0, x1, y, color, alpha=0.8, width=1.0, tick=6.0, label=None, f=None,
             label_gap=6.0):
    """Measurement line with end ticks — the reference's '750 px' language."""
    p.line([(x0, y), (x1, y)], color, width, alpha)
    p.line([(x0, y - tick), (x0, y + tick)], color, width, alpha)
    p.line([(x1, y - tick), (x1, y + tick)], color, width, alpha)
    if label and f:
        p.text(x0 + (x1 - x0) / 2, y - label_gap, label, f, color, anchor="mb", alpha=alpha)
