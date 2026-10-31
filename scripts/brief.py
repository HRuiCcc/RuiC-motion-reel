#!/usr/bin/env python3
"""一句话 brief -> 可执行的 SPEC.md，并把 palette / 时间网格 / 排版基调写进 theme.py。

    python3 brief.py "做一条 20 秒的咖啡品牌片，暖色胶片感，慢"
    python3 brief.py <project_dir> "做一条竖屏 30 秒，冷色科技感，快"

它不挑牌：没有 16 张风格卡这一层。从一句话里读出**时长 / 画幅 / 冷暖 / 质感 / 节奏 / 语言**，
再由这几项推出色板、字体、运动语法和分镜骨架。同一句话永远给同一个结果，
不同的话给不同的样子。

推完之后仍然要人（或 Agent）改 scenes.py —— SPEC.md 把"该长什么样"写清楚了，
但真正的画面还是要一场一场写出来。
"""
from __future__ import annotations

import argparse
import colorsys
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- parsing

DUR_PRESETS = [
    # (seconds, bars, bpm) —— 每小节整数帧的干净组合
    (12.0, 8, 160.0),
    (15.0, 8, 128.0),
    (24.0, 12, 120.0),
    (30.0, 10, 80.0),
    (40.0, 10, 60.0),
    (45.0, 12, 64.0),
    (60.0, 15, 60.0),
]

CN_NUM = {"半": 0.5, "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5,
          "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}

TEMPERATURE = [
    ("warm", ["暖", "温", "咖啡", "烘焙", "日落", "橙", "棕", "复古", "木", "茶", "黄昏", "胶片"]),
    ("cool", ["冷", "蓝", "夜", "冰", "科技", "赛博", "金属", "深夜", "极地", "电"]),
    ("neutral", ["极简", "中性", "白", "灰", "无印", "瑞士", "克制"]),
]

TEXTURE = [
    ("analog", ["胶片", "颗粒", "噪点", "halation", "光晕", "旧"]),
    ("print", ["印刷", "丝网", "riso", "油墨", "套印", "网点", "版画"]),
    ("neon", ["霓虹", "发光", "glow", "赛博", "科技", "电子", "终端"]),
    ("paper", ["纸", "手作", "拼贴", "卡纸", "剪贴", "标本"]),
    ("editorial", ["极简", "瑞士", "杂志", "编辑", "网格", "排版", "白底"]),
    ("dimensional", ["3d", "建模", "点云", "曲面", "金属", "雕塑", "产品渲染"]),
]

TEMPO = [
    ("low", ["慢", "舒缓", "安静", "呼吸", "温柔", "从容", "长镜头"]),
    ("high", ["快", "炸", "冲击", "燃", "高速", "密集", "卡点", "燃向"]),
]

TYPE_BY_TEXTURE = {
    "analog": ("BodoniModa700", "JBMono400", "衬线大标题 + 打字机等宽，字距放松"),
    "print": ("Fraunces900", "JBMono400", "粗衬线 + 等宽，油墨感重，字距收紧"),
    "neon": ("ArchivoBlack", "JBMono500", "超粗无衬线 + 仪表等宽，字距 -0.03em"),
    "paper": ("Fraunces900", "JBMono400", "手作衬线，轻微不规则"),
    "editorial": ("BodoniModa700", "Inter500", "大衬线标题 + 中性无衬线正文"),
    "dimensional": ("ArchivoBlack", "JBMono500", "几何无衬线 + 等宽读数"),
}

MOTION_BY_TEXTURE = {
    "analog": dict(easing="soft", entrance="fade-rise", cut="flash-frame", texture="halation + 两级颗粒 + 片门微抖"),
    "print": dict(easing="stepped", entrance="slide-ink", cut="ink-wipe", texture="网点 + 套印偏移 + 纸纹"),
    "neon": dict(easing="punch", entrance="slam-scale", cut="hard-flash", texture="bloom + 色差 + 扫描线"),
    "paper": dict(easing="spring", entrance="drop-settle", cut="page-turn", texture="纸纹 + 投影 + 手撕边"),
    "editorial": dict(easing="linear", entrance="mask-reveal", cut="wipe", texture="无颗粒，只有纸白与发丝线"),
    "dimensional": dict(easing="soft", entrance="orbit-in", cut="depth-push", texture="点云 + 景深 + 布光"),
}


def _num(tok: str) -> float:
    tok = tok.strip()
    if tok in CN_NUM:
        return CN_NUM[tok]
    try:
        return float(tok)
    except ValueError:
        return 0.0


def parse_duration(text: str):
    m = re.search(r"(\d+(?:\.\d+)?|[一二两三四五六七八九十半])\s*(分钟|分|秒|s\b|sec)", text, re.I)
    if m:
        v = _num(m.group(1))
        unit = m.group(2).lower()
        secs = v * 60 if unit in ("分钟", "分") else v
        if 4 <= secs <= 180:
            return secs, "句子里的时长"
    if "半分钟" in text:
        return 30.0, "半分钟"
    return 15.0, "没写时长，按你说的默认 15 秒"


def parse_canvas(text: str):
    if re.search(r"竖屏|9\s*[:：]\s*16|抖音|小红书|短视频", text):
        return (1080, 1920), (720, 1280), "竖屏"
    if re.search(r"方屏|1\s*[:：]\s*1|正方形", text):
        return (1080, 1080), (720, 720), "方屏"
    if re.search(r"4k|2160", text, re.I):
        return (3840, 2160), (1920, 1080), "4K 横屏"
    return (1920, 1080), (1280, 720), "横屏 16:9"


def parse_fps(text: str):
    if re.search(r"60\s*(fps|帧)", text, re.I):
        return 60
    if re.search(r"24\s*(fps|帧)", text, re.I):
        return 24
    return 30


def _pick(text: str, table, default):
    for name, words in table:
        for w in words:
            if w in text.lower():
                return name, w
    return default, None


def snap(seconds: float, fps: int, target_bpm: float = 120.0):
    """选最接近的干净预设；都不合适就反解，并挑离目标 BPM 最近的那组。"""
    best = min(DUR_PRESETS, key=lambda p: abs(p[0] - seconds))
    if abs(best[0] - seconds) <= 0.25:
        return best[0], best[1], best[2], "贴近的干净预设"
    cands = []
    for bars in range(4, 33):
        bpm = 240.0 * bars / seconds
        fpb = seconds * fps / bars
        if 55 <= bpm <= 190 and abs(fpb - round(fpb)) < 1e-6:
            cands.append((abs(bpm - target_bpm), bars, round(bpm, 3)))
    if cands:
        _, bars, bpm = min(cands)
        return seconds, bars, bpm, "反解（每小节整数帧）"
    bars = max(4, round(seconds / target_bpm * 4))
    return seconds, bars, 240.0 * bars / seconds, "反解（不保证整数帧）"


# ---------------------------------------------------------------- palette

def _hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s)))
    return (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))


HUE_WORDS = [("绿", 120), ("青", 186), ("蓝", 214), ("紫", 285), ("粉", 332),
             ("红", 4), ("橙", 30), ("黄", 46), ("金", 46), ("棕", 26), ("咖", 26)]


def hue_from_text(text: str):
    """句子里点名了颜色就听句子的，别让质感把主色带跑。"""
    for w, h in HUE_WORDS:
        if w in text:
            return h
    return None


def build_palette(temp: str, texture: str, light: bool, hue_override=None):
    base_h = {"warm": 26, "cool": 214, "neutral": 210}[temp]
    sat = {"warm": 0.42, "cool": 0.52, "neutral": 0.10}[temp]
    acc_h = {
        "analog": base_h + 4, "print": 340, "neon": 198,
        "paper": base_h + 8, "editorial": base_h, "dimensional": 190,
    }[texture]
    if hue_override is not None:
        acc_h = hue_override
    acc_s = {"analog": 0.58, "print": 0.66, "neon": 0.88,
             "paper": 0.46, "editorial": 0.72, "dimensional": 0.70}[texture]
    if hue_override is not None:
        acc_s = max(acc_s, 0.62)

    if light:
        ink = _hsl(base_h, sat * 0.35, 0.10)
        bg0 = _hsl(base_h, sat * 0.22, 0.955)
        bg1 = _hsl(base_h, sat * 0.26, 0.925)
        bg2 = _hsl(base_h, sat * 0.30, 0.885)
        white = (250, 249, 246)
        paper = bg0
        card = (255, 255, 255)
        grey = _hsl(base_h, 0.06, 0.50)
        grey_d = _hsl(base_h, 0.07, 0.33)
        slate = _hsl(base_h, 0.10, 0.22)
    else:
        ink = _hsl(base_h, sat * 0.9, 0.028)
        bg0 = _hsl(base_h, sat * 0.85, 0.055)
        bg1 = _hsl(base_h, sat * 0.80, 0.095)
        bg2 = _hsl(base_h, sat * 0.72, 0.145)
        white = _hsl(base_h, 0.10, 0.965)
        paper = _hsl(base_h, 0.06, 0.93)
        card = (255, 255, 255)
        grey = _hsl(base_h, 0.08, 0.52)
        grey_d = _hsl(base_h, 0.12, 0.33)
        slate = _hsl(base_h, 0.18, 0.20)

    return {
        "INK": ink, "BG0": bg0, "BG1": bg1, "BG2": bg2,
        "ACCENT": _hsl(acc_h, acc_s, 0.50),
        "ACCENT_BR": _hsl(acc_h, min(1.0, acc_s + 0.06), 0.64),
        "ACCENT_LT": _hsl(acc_h, max(0.12, acc_s - 0.34), 0.80),
        "ACCENT_DK": _hsl(acc_h, acc_s, 0.30),
        "ALT": _hsl(acc_h + 150, 0.62, 0.58),
        "INFO": _hsl(205, 0.68, 0.55),
        "WARN": _hsl(34, 0.86, 0.55),
        "ERR": _hsl(2, 0.76, 0.55),
        "WHITE": white, "PAPER": paper, "CARD": card,
        "GREY": grey, "GREY_D": grey_d, "SLATE": slate,
    }


def build_spec(brief: str) -> dict:
    dur, dur_src = parse_duration(brief)
    (ow, oh), (aw, ah), shape = parse_canvas(brief)
    fps = parse_fps(brief)
    temp, temp_w = _pick(brief, TEMPERATURE, "neutral")
    texture, tex_w = _pick(brief, TEXTURE, "editorial")
    tempo, tempo_w = _pick(brief, TEMPO, "mid")
    light = texture in ("editorial", "print", "paper")
    if re.search(r"白底|亮底|浅色|米白|纸白|白纸|留白", brief):
        light = True
    elif re.search(r"黑底|暗底|暗色|深色|夜景|夜空|黑场", brief):
        light = False

    target_bpm = {"low": 84.0, "mid": 120.0, "high": 150.0}[tempo]
    secs, bars, bpm, how = snap(dur, fps, target_bpm)
    density = {"low": "稀疏，一小节只发生一件事",
               "mid": "中等，一小节 2~3 个动作",
               "high": "密集，一小节 4 个以上动作"}[tempo]
    display, mono, tyspec = TYPE_BY_TEXTURE[texture]
    motion = MOTION_BY_TEXTURE[texture]
    pal = build_palette(temp, texture, light, hue_from_text(brief))
    lang = "英文" if re.search(r"英文|english", brief, re.I) else ("中文" if re.search(r"中文|汉字|国语", brief) else "按 brief 原文")
    return dict(
        brief=brief, seconds=secs, bars=bars, bpm=bpm, fps=fps, how=how, dur_src=dur_src,
        out=(ow, oh), author=(aw, ah), shape=shape, light=light,
        temperature=temp, temp_word=temp_w, texture=texture, tex_word=tex_w,
        tempo=tempo, tempo_word=tempo_w, density=density,
        display=display, mono=mono, type_note=tyspec, motion=motion,
        palette=pal, language=lang,
    )


# ---------------------------------------------------------------- output

ACT_TEMPLATE = {
    8: ["建立：一个符号 + 一句主张", "建立：语境（机器/产品/人）", "证明 A：动字",
        "证明 B：结构或数据", "证明 C：特写或界面", "转向：清单/对比", "高潮：冲击",
        "落版：标识 + 一句话"],
    10: ["建立", "建立", "证明 A", "证明 B", "证明 C", "转向", "快剪", "蓄力", "冲击", "落版"],
    12: ["点燃：符号", "终端/机器：语境", "动字：主张", "结构：节点或管线", "仪表：读数",
         "切换：清单上滚", "故障：失控", "爆点：粒子", "快剪：四刀", "蓄力：收成一帧",
         "撞击：主标", "端卡：原话"],
    15: ["点燃", "语境", "主张", "结构", "读数", "切换", "故障", "爆点", "快剪 A", "快剪 B",
         "蓄力", "蓄力", "撞击", "端卡", "留白"],
}


def spec_markdown(s: dict) -> str:
    acts = ACT_TEMPLATE.get(s["bars"])
    if acts is None:
        acts = ["建立"] * max(1, s["bars"] // 3) + ["证明"] * max(1, s["bars"] // 3)
        acts += ["高潮"] * max(1, s["bars"] - len(acts) - 1) + ["落版"]
        acts = acts[: s["bars"] - 1] + ["落版"]
    pal = s["palette"]
    rows = "\n".join(f"| `{k}` | `#{r:02X}{g:02X}{b:02X}` |" for k, (r, g, b) in pal.items())
    aspect_note = ""
    if (s["out"][0], s["out"][1]) != (1920, 1080):
        aspect_note = (
            "> ⚠️ 画幅不是 16:9：模板里 8 个场景的版式是按 16:9 画的，作者空间已改成 "
            "%d×%d，**场景要按新画幅重排**（HUD 常量在 theme.py 的 HUD chrome 段）。"
            % (s["author"][0], s["author"][1])
        ) + chr(10) + chr(10)
    bar_rows = "\n".join(
        f"| {i + 1} | {i * (s['seconds'] / s['bars']):.2f}–{(i + 1) * (s['seconds'] / s['bars']):.2f}s | {a} |"
        for i, a in enumerate(acts))
    return f"""# SPEC —— 从这一句话推出来的

> {s['brief']}

## 一句话读成了什么

| 读到的 | 结论 | 依据 |
|---|---|---|
| 时长 | **{s['seconds']:g} 秒**（{s['bars']} 小节 × {s['seconds'] / s['bars']:.3f}s @ {s['bpm']:g} BPM） | {s['dur_src']}；{s['how']} |
| 画幅 | **{s['out'][0]}×{s['out'][1]}**（{s['shape']}），{s['fps']}fps | 句子里的画幅词；没写就用 16:9 / 30fps |
| 冷暖 | **{s['temperature']}**{'（命中「%s」）' % s['temp_word'] if s['temp_word'] else '（无明确词，取中性）'} | 先看色彩词，再看名词的联想 |
| 质感 | **{s['texture']}**{'（命中「%s」）' % s['tex_word'] if s['tex_word'] else '（无明确词，取编辑排版）'} | 决定后期与转场 |
| 节奏 | **{s['tempo']}** —— {s['density']} | 决定一节能塞几个动作 |
| 语言 | {s['language']} | 句子本身 |

- 底板：**{'亮底' if s['light'] else '暗底'}**
- 字体：`{s['display']}` 做标题 + `{s['mono']}` 做读数。{s['type_note']}
- 运动：`{s['motion']['easing']}` 缓动 / 入场 `{s['motion']['entrance']}` / 转场 `{s['motion']['cut']}`
- 后期：{s['motion']['texture']}

## 色板（由冷暖 + 质感推出来的，不是挑的）

| token | 值 |
|---|---|
{rows}

> 想换主色只改 `ACCENT` 一族（`ACCENT / ACCENT_BR / ACCENT_LT / ACCENT_DK`），
> 其余四档明度会自动跟得上，因为它们是同一组 H/S/L 的不同明度。

## 分镜骨架（{s['bars']} 小节 = {s['bars']} 刀）

{aspect_note}

| # | 时间 | 这一刀要解决的事 |
|---|---|---|
{bar_rows}

> 这是骨架，不是画面。每一刀具体画什么，按 `references/design-grammar.md` 写进 `scenes.py`；
> 需要的话在 `scenes.py` 里写 `SEQUENCE` 把某一刀拆成两小节。

## 现在动手

```bash
# 1. 确认片长/画幅/色板已经写进工程
grep -n "^BPM\\|^BARS\\|^OUT_W" theme.py
# 2. 改 identity（BRAND / DOMAIN / TAGLINE）和文案
# 3. 一场一场写 scenes.py
python3 -m <pkg>.build --stills 0     # 每场抽 7 帧审阅
python3 -m <pkg>.build                # 出片
```
"""


PALETTE_HEADER = """# --- palette ----------------------------------------------------------------
# 由 scripts/brief.py 从 brief 推出来的：冷暖决定基色相，质感决定主色的饱和度与明度，
# 亮底/暗底决定整组明度。改主色只动 ACCENT 一族，其余四档会跟着走。
DIRECTION = {direction!r}
"""


def apply_to_theme(theme_path: Path, s: dict):
    src = theme_path.read_text(encoding="utf-8")

    # 1) 时间网格
    src = re.sub(r"^FPS = \d+$", "FPS = %d" % s["fps"], src, flags=re.M)
    src = re.sub(r"^BPM = [\d.]+$", "BPM = %s" % ("%g" % s["bpm"]), src, flags=re.M)
    src = re.sub(r"^BARS = \d+$", "BARS = %d" % s["bars"], src, flags=re.M)
    src = re.sub(r"^DUR = BAR \* BARS.*$", "DUR = BAR * BARS           # %.3f s" % s["seconds"], src, flags=re.M)
    src = re.sub(r"^NFRAMES = int\\(round\\(DUR \\* FPS\\)\\).*$",
                 "NFRAMES = int(round(DUR * FPS))   # %d" % round(s["seconds"] * s["fps"]), src, flags=re.M)

    # 2) 画幅
    src = re.sub(r"^OUT_W, OUT_H = .*$", "OUT_W, OUT_H = %d, %d" % s["out"], src, flags=re.M)
    src = re.sub(r"^W, H = .*$", "W, H = %d, %d" % s["author"], src, flags=re.M)

    # 3) 色板：整段替换
    block = PALETTE_HEADER.format(
        direction="%s / %s / %s / %s" % (s["temperature"], s["texture"], s["tempo"], "light" if s["light"] else "dark"))
    for name in ("INK", "BG0", "BG1", "BG2", "ACCENT", "ACCENT_BR", "ACCENT_LT", "ACCENT_DK",
                 "ALT", "INFO", "WARN", "ERR", "WHITE", "PAPER", "CARD", "GREY", "GREY_D", "SLATE"):
        r, g, b = s["palette"][name]
        block += "%-10s = (%3d, %3d, %3d)\n" % (name, r, g, b)
    block += "\n"
    src = re.sub(r"# --- palette -+\n.*?(?=# --- type -+)", block, src, flags=re.S)

    theme_path.write_text(src, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("args", nargs="+", help="[project_dir] <brief>")
    a = ap.parse_args()
    if len(a.args) == 1:
        proj, brief = ".", a.args[0]
    else:
        proj, brief = a.args[0], " ".join(a.args[1:])

    s = build_spec(brief)
    pkg_dir = None
    for d in sorted(Path(proj).iterdir() if os.path.isdir(proj) else []):
        if (d / "theme.py").exists() and (d / "scenes.py").exists():
            pkg_dir = d
            break
    if pkg_dir is None:
        sys.exit("找不到 theme.py / scenes.py —— 先跑 new_reel.py 建工程，或在工程根目录里运行")

    apply_to_theme(pkg_dir / "theme.py", s)
    (Path(proj) / "SPEC.md").write_text(spec_markdown(s), encoding="utf-8")
    (Path(proj) / "SPEC.json").write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")

    print("brief   ", brief)
    print("length  ", "%g s / %d bars @ %g BPM = %d frames"
          % (s["seconds"], s["bars"], s["bpm"], round(s["seconds"] * s["fps"])))
    print("canvas  ", "%dx%d @ %d" % (s["out"][0], s["out"][1], s["fps"]))
    print("style   ", "%s / %s / %s / %s" % (s["temperature"], s["texture"], s["tempo"],
                                             "light" if s["light"] else "dark"))
    print("wrote   ", pkg_dir / "theme.py", "+ SPEC.md + SPEC.json")


if __name__ == "__main__":
    main()
