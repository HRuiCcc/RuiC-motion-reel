#!/usr/bin/env python3
"""Draw a visual language for the next reel.

    python3 style_lottery.py                    # draw one
    python3 style_lottery.py --seed 7           # reproducible draw
    python3 style_lottery.py --list             # the whole deck
    python3 style_lottery.py --avoid neon-hud,riso-press
    python3 style_lottery.py --write ~/my-reel  # leave STYLE.md in the project

Why a deck: the engine can make very different films, and left to itself it
keeps making its loudest one — near-black plate, neon, HUD chrome, a 3D
hardware shot. That is one card, not the house style. A quiet card done well
(editorial type on board, a specimen label, a pencil sketch) is a better film
than the loud one made a fourth time, so the default is a draw, not a repeat.

Each card carries: the idiom, the plate and ink direction, the moves that make
it read as itself, the typography, the sound, and which part of the engine to
lean on. `author_at_delivery` is the one structural choice on a card — texture
cards (halftone dots, stipple, fine print) want the scenes laid out at the
delivery size so those masks are born sharp instead of resampled.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

CARDS = [
    {
        "id": "neon-hud",
        "name": "暗色科技 · HUD",
        "idiom": "近黑底板上的加色光：霓虹青/品红，HUD 套件，发光大字。",
        "plate": "近黑墨色压暗的品牌色（例如 #05090F），主色仍是品牌色本体",
        "moves": ["加色光缓冲（add）+ bloom 让亮部自己发光",
                  "色差 1.2~2.2px、扫描线 0.014~0.018、暗角 0.44~0.54",
                  "HUD 角标 / 刻度 / 时间码 / 实时读数",
                  "一次硬切帧（白闪）把节奏打断一次"],
        "type": "超粗无衬线大字（Archivo Black），小字用等宽体做读数",
        "sound": "128~160 BPM，底鼓推进，riser + impact 落在切点",
        "engine": "core（bloom/chroma/scanlines）+ dsp",
        "note": "最容易被滥用的一张。如果没有品牌色要读，先想想为什么不做张安静的。",
    },
    {
        "id": "riso-press",
        "name": "丝网印 / riso 四色",
        "idiom": "暖米纸张 + 荧光油墨，网点、套印、纸纹，像一张刚下机的印刷品。",
        "plate": "暖米纸（#F3EEE5 一类），纸纹用 fiber_field + paper_field",
        "moves": ["分色成 3~4 块油墨版，每版不同网线角度（15°/45°/75°）",
                  "multiply 叠印：粉压蓝是真紫，黄压蓝是真绿",
                  "套印偏移 0.5~1.5px + 墨边软化（吸收）",
                  "裁切线、套准规、色标条"],
        "type": "粗标题字 + 印刷体小字，字距紧",
        "sound": "96~120 BPM，颗粒感的鼓与贝斯",
        "engine": "core 的印刷原语 + halftone/ink_coverage",
        "author_at_delivery": True,
        "note": "网点是细节，必须按交付尺寸排版，别让 1080p 的网点来自 720p 的重采样。",
    },
    {
        "id": "darkroom-silver",
        "name": "暗房 / 银盐",
        "idiom": "中性纸白 + 碳黑 + 一个安全灯红，没有网点也没有霓虹。",
        "plate": "纸白 #E8E6E1 到碳黑 #14161A，唯一的色彩是安全灯红",
        "moves": ["光晕 halation（亮部溢出的红边）",
                  "片门微抖（每帧亚像素位移）+ 两级银盐颗粒",
                  "点云刻线做主体，线条像被曝光过",
                  "曝光表 / 灰阶卡做读数"],
        "type": "衬线或窄体无衬线，字重中等，不要超粗",
        "sound": "中低频铺底，几乎无打击乐，像暗房里的水泵声",
        "engine": "three（点云刻线）+ core（颗粒/halation）",
        "note": "安静的一张。它的力量来自留白和颗粒，不要往里塞 HUD。",
    },
    {
        "id": "planck-stellar",
        "name": "恒星 · 普朗克真彩色",
        "idiom": "深棕余烬底 + 黑体色温条 + 谱线，没有一个是挑的。",
        "plate": "余烬深棕（#1A1310 一类），亮度全部来自色温",
        "moves": ["普朗克 → CIE 1931 → sRGB 反解颜色（engine/color.py）",
                  "色温条从 2000K 扫到 12000K",
                  "真谱线（H-alpha 656nm 等）作为刻度",
                  "点云磁流管沿场线流动"],
        "type": "细体大写 + 等宽读数，字号克制",
        "sound": "长音铺底 + 缓慢滤波扫频，无鼓",
        "engine": "color（物理反解）+ three（点云）+ dsp（时变滤波）",
        "note": "颜色必须由物理量算出来，一旦凭感觉挑就失去这张牌的意义。",
    },
    {
        "id": "blueprint-cyanotype",
        "name": "氰版蓝图",
        "idiom": "普鲁士蓝底 + 白色线稿 + 尺寸标注，像一张工程图。",
        "plate": "普鲁士蓝（#123A6B 一类），白线 1~2px",
        "moves": ["白线工程图：剖视、尺寸线、引出线、剖面线",
                  "网格纸底 + 图框标题栏",
                  "线稿逐段画出（stroke reveal），按拍推进",
                  "局部套色（一个红色标注）"],
        "type": "等宽工程体为主，标题用手写体或窄体大写",
        "sound": "规律的机械节拍，打点与咔哒声",
        "engine": "core 的画线/网格 + three（等轴测投影）",
        "note": "尺寸数字要与画面里的图形一致，编数字会被一眼看穿。",
    },
    {
        "id": "deckle-paper",
        "name": "纸艺 / 纸感",
        "idiom": "日光下的桌面，纸的纤维、毛边和投影。",
        "plate": "日光纸白 + 灰蓝投影，全部是物理质感",
        "moves": ["纸质纤维（fiber_field）+ 纸浆斑（mottle）",
                  "毛边（deckle）：alpha 边缘用噪声切",
                  "投影：软高斯乘在底板（柔和，不是硬阴影）",
                  "实物摆放：叠纸、卡片、便签"],
        "type": "印刷体 + 手写批注",
        "sound": "80 BPM，木琴/电钢，干燥的房间感",
        "engine": "core（纸纹/投影）+ anim（缓动）",
        "author_at_delivery": True,
        "note": "投影要软、要偏冷。硬阴影会立刻把这张牌变成剪贴画。",
    },
    {
        "id": "swiss-editorial",
        "name": "瑞士编辑排版",
        "idiom": "大号无衬线 + 12 栏网格 + 发丝线，两个墨色一个强调色，没有光。",
        "plate": "纸白或浅灰板，墨黑 + 一个强调色（红或蓝）",
        "moves": ["12 栏网格；每次剪辑对准一栏",
                  "发丝分割线、页码、栏标",
                  "文字块整体位移入场（不是逐字飞入）",
                  "一次倒转：黑底白字整屏反相"],
        "type": "Helvetica/Inter 一类中性无衬线，字号跳跃要大",
        "sound": "96~112 BPM，干净的四四拍，留白多",
        "engine": "core 的排版/网格；不要用 bloom",
        "note": "这张牌的成败在网格和字号对比，不在特效。对齐错了就全错。",
    },
    {
        "id": "kinetic-type",
        "name": "动态字体",
        "idiom": "字就是唯一的画面：一词一拍，遮罩、缩放、跳切。",
        "plate": "单色板（黑、白、或一个品牌色），无纹理",
        "moves": ["一个词一拍，剪在强拍上",
                  "遮罩揭示 / 字块滑出 / 尺度跳变",
                  "文字轮廓描边、局部反白",
                  "整屏反转作为结束"],
        "type": "一套字走到底，字重与字距做对比",
        "sound": "120~140 BPM，鼓点清晰，字与鼓同帧",
        "engine": "core 的 text/text_slices/text_outline",
        "note": "字与拍必须同帧。差 2 帧（33ms）就散架。",
    },
    {
        "id": "sketch-notebook",
        "name": "手绘 / 速写本",
        "idiom": "米白纸上的铅笔与墨水线，排线做明暗，像正在被画出来。",
        "plate": "米白速写纸（#F5F1E8），铅笔灰 + 一支墨水笔",
        "moves": ["线条逐段画出（笔尖跟随）",
                  "排线（hatching）做明暗，不用渐变",
                  "轻微套印不齐 + 橡皮擦痕",
                  "手写标注与箭头"],
        "type": "手写体 + 等宽批注",
        "sound": "铅笔沙沙声 + 木琴，低 BPM（72~88）",
        "engine": "core 的 line/path（带抖动）+ anim 的值噪声",
        "note": "抖动量要小（0.3~0.8px）。抖大了像坏掉的动画，不像手画。",
    },
    {
        "id": "catalogue-specimen",
        "name": "标本 / 图录",
        "idiom": "博物馆图录的一页：编号、标题、测量标注、中性底板。",
        "plate": "中性米灰板（#E9E7E2），一个强调色",
        "moves": ["编号 + 拉丁名式标题 + 尺寸标注",
                  "静物居中，缓慢推近",
                  "测量线、比例尺、切角标记",
                  "翻页式切场（整页替换）"],
        "type": "衬线标题 + 等宽编号，字号克制",
        "sound": "60~80 BPM，弦乐或电钢长音",
        "engine": "core 的版式 + three（标本本体）",
        "note": "画面里的每个数字都要是代码算出来的真值，不许编。",
    },
    {
        "id": "letterpress-ink",
        "name": "凸版 / 活字",
        "idiom": "棉纸上的压痕，单一墨色，木头活字的粗狂。",
        "plate": "棉纸白（#F4F1EA），墨黑或单一彩色（专色红）",
        "moves": ["压痕：字形边缘一圈暗边（内阴影）",
                  "墨量不匀（ink_coverage）+ 局部缺墨",
                  "活字块拼版、逐个落版",
                  "套印偏移 1px 上下"],
        "type": "活字风粗衬线 / 木活字风展示体",
        "sound": "低频木质感打击 + 短混响",
        "engine": "core 的印刷原语（压痕用 multiply 深色描边模拟）",
        "author_at_delivery": True,
        "note": "压痕要窄（2~3px）且只在一侧，四周都压会变成浮雕。",
    },
    {
        "id": "soft-gradient",
        "name": "柔光渐变 / 极光",
        "idiom": "没有字体英雄主义：大色块缓慢漂移，用遮罩揭示，安静。",
        "plate": "两到三个邻近色的长渐变，阴影带色（不是黑）",
        "moves": ["大尺度渐变体缓慢漂移 + 轻微形变",
                  "遮罩揭示（不是淡入）",
                  "叠加噪声膜（film grain 0.008~0.014）",
                  "一次尺度突变做高潮，其余全慢"],
        "type": "小字、细体、字距大；大字只出现一次",
        "sound": "铺底长音 + 稀疏钟声，无鼓",
        "engine": "core（hgrad/vgrad/gauss）+ anim（错帧）",
        "note": "慢不等于闷：至少要有一次尺度或色相的突变，否则观众会走神。",
    },
    {
        "id": "data-infographic",
        "name": "数据图版",
        "idiom": "图表就是主角：柱、线、表盘按拍长出来。",
        "plate": "深或浅的纯板，网格线极淡",
        "moves": ["柱/线/表盘按拍生长（ease 收尾要硬）",
                  "坐标轴、刻度、单位标注",
                  "一个数据点被高亮（唯一强调色）",
                  "数字滚动到位后停住"],
        "type": "等宽数字 + 中性无衬线标签",
        "sound": "112~128 BPM，电气化，打点与生长同帧",
        "engine": "core 的画线/rect + anim",
        "note": "所有数值要标注它是示例数据；编造的产品数字会变成虚假宣传。",
    },
    {
        "id": "collage-cutout",
        "name": "拼贴 / 剪纸",
        "idiom": "撕纸边、胶带、复印机噪点、错位的叠层。",
        "plate": "牛皮纸 + 白纸 + 复印灰，三到五层叠",
        "moves": ["撕边：alpha 用噪声切出毛边",
                  "复印机噪点 + 局部过曝",
                  "层间错位（每层差 2~6px）+ 轻微旋转",
                  "胶带条把两层粘住"],
        "type": "剪下来的印刷字块（边缘带白边）",
        "sound": "循环采样感（用合成器做 loop）+ 打击乐",
        "engine": "core 的 blit/噪声遮罩 + 分色",
        "author_at_delivery": True,
        "note": "层数别超过五层，错位别超过 6px，否则读不出层次只剩脏。",
    },
    {
        "id": "uv-litho",
        "name": "紫外光刻 / 半导体",
        "idiom": "近黑冷蓝的腔体里只有一束 405 nm：版图、掩膜、曝光、显影、探针，"
                 "一条片子讲完「一片晶圆是怎么被光写出来的」。",
        "plate": "近黑冷蓝 #03050A，主色是 405 nm 反解出来的紫外紫，"
                 "读数用深紫外荧光青，只有一个切红（355 nm 划片）",
        "moves": ["薄膜干涉真彩：SiO₂ 厚度 → 反射光谱 → CIE 1931 → sRGB；"
                  "一档干涉级差约 188 nm，一条半径扫 380 nm 就是好几圈彩虹",
                  "递归 floorplan 生成芯片版图：每切一刀留一条布线沟，"
                  "叶子填标准单元行或存储阵列，层越往上越粗、线越宽",
                  "曝光场：振幅孔径（铬挡光）过一组和为 0 的高斯差做 PSF，再平方——"
                  "边缘的衍射条纹是算出来的，不是叠一层滤镜",
                  "彩色点云：把每个点自己的颜色带进排序散射，"
                  "晶圆因此能被自己的氧化层厚度上色（mg.three 的单一 lum 版做不到）",
                  "仪器家具：套准规、显微刻度尺、晶圆图当进度条"],
        "type": "Inter 900 压场配 JetBrains Mono 读数，全大写，字距紧",
        "sound": "160 BPM 冷感机械电子：干底鼓 + 非谐金属打击（不是谐波列）"
                 "+ acid 贝斯（共振低通包络）",
        "engine": "core 的解析遮罩 + three 的彩色点云 + color/薄膜光学 + dsp",
        "note": "颜色是解出来的：405 nm、氧化层彩虹都从物理量反解。"
                "把它改成「凭感觉挑的紫色」这张牌就废了——同一支片子的价值全在颜色追得到出处。",
    },
    {
        "id": "brand-light-plate",
        "name": "品牌亮色产品片",
        "idiom": "品牌自己的纸白当底板，品牌色满幅压中间一条，迪多尼大标题骑在极淡的网格上，"
                 "两场暗场换气。整条片子只服务一件事：让这个品牌的 logo 和产品界面成立。",
        "plate": "品牌官网 bg-page 的亮色（实测值），主色是品牌色本体，"
                 "只有两场切到暗底；亮底不做 grade，暗底才做",
        "moves": ["开场与谢幕用官方 lockup 直接打：标 + 字标，"
                  "字标一律 blit 真素材位图，绝不重排成「像 logo 的字体」",
                  "品牌色做满幅那一条是最响的一拍，上面只放白字，不叠任何特效",
                  "产品界面按品牌自己的亮色主题复刻，占一整小节（卡片 / 开关 / 步骤态 / 预览框）",
                  "大标题用迪多尼（Bodoni Moda），字号按词反解到画幅比例，"
                  "副标要挂在字块自己的字高带上，不是固定 y",
                  "两场暗场（粒子流场 + 谢幕 assembling）把眼睛从纸白里拉出来",
                  "四角 HUD 换成品牌自己的域名与产品线，读数数字全部从 theme 常量取"],
        "type": "Bodoni Moda 900 做标题 + JetBrains Mono 做 HUD/读数 + Inter 做界面文字；"
                "品牌字标是位图，不是字体",
        "sound": "128 BPM，干净四四拍 + 第 16 分音符门限 stabs，"
                 "后半段加钟琴旋律，最后一小节回到主音",
        "engine": "core 的排版/网格 + blit 品牌资产（tint/mode=add）+ dsp",
        "note": "亮底片的后期是反的，两个数必须量：bloom 阈值要高过底板自己——"
                "纸白 0.97 → 阈值 0.99，品牌蓝的 B 通道 0.996 → 阈值要 1.01 以上，"
                "否则底板自己够格当高光，整帧洗白。品牌色与 logo 必须取官网真素材实测，"
                "不能凭印象挑色、不能手画标。所有上屏数字要能对上代码常量。",
    },
]


def card_markdown(card):
    lines = [
        "# STYLE — %s  (`%s`)" % (card["name"], card["id"]),
        "",
        "> %s" % card["idiom"],
        "",
        "| | |",
        "|---|---|",
        "| 底板 / 墨色 | %s |" % card["plate"],
        "| 字体 | %s |" % card["type"],
        "| 音乐 | %s |" % card["sound"],
        "| 引擎 | %s |" % card["engine"],
        "| 排版空间 | %s |" % ("交付尺寸（网点/纹理要原生清晰）"
                               if card.get("author_at_delivery")
                               else "默认：W,H = 1280x720，交付 1920x1080"),
        "",
        "## 让它像这张牌的招式",
        "",
    ]
    lines += ["- %s" % m for m in card["moves"]]
    lines += ["", "## 注意", "", card["note"], ""]
    return "\n".join(lines)


def draw(rng, avoid=()):
    pool = [c for c in CARDS if c["id"] not in avoid] or CARDS
    return rng.choice(pool)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--seed", type=int, default=None, help="reproducible draw")
    ap.add_argument("--avoid", default="", help="comma-separated card ids to skip")
    ap.add_argument("--list", action="store_true", help="print the deck and exit")
    ap.add_argument("--json", action="store_true", help="machine-readable draw")
    ap.add_argument("--write", default=None,
                    help="project directory: also write STYLE.md there")
    a = ap.parse_args()

    if a.list:
        for c in CARDS:
            print("%-20s %-22s %s" % (c["id"], c["name"], c["idiom"]))
        print("\n%d cards. texture-heavy ones want `author_at_delivery`." % len(CARDS))
        return

    avoid = {s.strip() for s in a.avoid.split(",") if s.strip()}
    rng = random.Random(a.seed)
    card = draw(rng, avoid)

    if a.json:
        print(json.dumps(card, ensure_ascii=False, indent=2))
        return

    print(card_markdown(card))
    if a.write:
        dest = os.path.abspath(os.path.expanduser(a.write))
        os.makedirs(dest, exist_ok=True)
        path = os.path.join(dest, "STYLE.md")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(card_markdown(card))
        print("wrote %s" % path)


if __name__ == "__main__":
    main()
