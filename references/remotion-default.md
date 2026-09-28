# 默认出口：为什么这条技能默认不走这个引擎

用户 2026-09-28 定调：**「之后视频生成要用 Remotion 这类可以上 GPU 的」**
（起因是本引擎把 6 路 CPU 跑满 16 分钟，他当场说"cpu爆了"）。

所以本技能从"默认引擎"降级为**特殊风格的最后手段**。这份文档说清三件事：
默认走什么、**显卡到底在哪一步出力**（这处最容易被想当然）、以及什么时候才该回来用本引擎。

## 一、默认路线

| 要做的东西 | 走哪条 |
|---|---|
| 常规竖屏 / 横屏成片（单项目推荐、榜单、宣传片…） | **本机已有的 Remotion 产线**，见下面第四节 |
| 需要本引擎独有能力的（点云写实 3D、印刷分色、普朗克真彩色、合成器配乐） | 本技能，**并且按第二节配编码、按第三节压并行度** |

新片先翻一遍已有产线，**从最接近的那条复制一份改数据文件**（各产线的数据入口在 `AGENTS.md` §3 那张表里），
不要为了新片子重写一套引擎。

## 二、显卡到底在哪一步出力（别想当然）

**Remotion 本身不是 GPU 渲染。** 它的帧是 headless Chrome 画出来的：
DOM / CSS / 文字 / SVG 这些内容由 Chrome 在 **CPU** 上光栅化（Skia），
`--gl=angle|egl|vulkan` 只在**真的用了 WebGL / three.js / canvas-GL** 的 compositon 上才有收益。
所以"换 Remotion 就自动用上显卡"是不成立的；换它主要买的是**并行度**和**成熟工具链**。

**真正吃显卡的是编码那一步。** 实测（本机 RTX 5060 / 驱动 595.71，1920×1080，
本引擎渲出来的 90 帧真实序列）：

| 编码器 | 耗时 | 体积 | PSNR vs 源帧 | SSIM |
|---|---|---|---|---|
| `h264_nvenc`（配方见下） | **1.11 s** | 6.77 MB | 46.35 dB | 0.9836 |
| `libx264 -preset slow -crf 16` | 4.08 s | 9.34 MB | 47.26 dB | 0.9847 |

**快 3.7 倍、体积还小 28%，代价约 0.9 dB PSNR**（这个量级肉眼基本看不出）。
**编码一律走 NVENC，留 libx264 兜底。**

```bash
ffmpeg -framerate 30 -i frames/f%04d.png \
  -c:v h264_nvenc -preset p7 -tune hq -rc vbr -cq 19 -b:v 0 \
  -spatial_aq 1 -temporal_aq 1 -aq-strength 12 -bf 3 \
  -pix_fmt yuv420p out/silent.mp4
```

**AQ 必须开**（`-spatial_aq 1 -temporal_aq 1 -aq-strength 12`）：渐变和颗粒满屏的片子
不开会在暗部起带状。

⚠️ **编码快了也不等于整帧快了**：这条片子的 450 帧是 969 秒渲染 + 约 20 秒编码
——编码只占 2%。**瓶颈永远是出帧那一步**，见 `performance.md`。

## 三、并行度：不许吃满全机

一场一核就够了，**最多不超过场景数**——多给的 worker 只会空转。
模板的 `build.py` 已经把 `--jobs` 夹到 `场景数` 以内并打印提示，别绕开它手写大数字。

宁可跑十分钟、机器还能用，也不要跑三分钟、机器动不了。

## 四、本机已有的 Remotion 产线（默认出口）

| 触发词 | 技能 | 工程 |
|---|---|---|
| 耶莱skill / CRT 终端风 | `yelai-skill` | `RuiC-yelai-jiade/` |
| 亚莱skill / 科技暗黑 | `yalai-skill` | `E:\Admin\Desktop\zcode\RuiC-yalai-shorts\` |
| 克莱skill / 琥珀终端 | `kela-skill` | `RuiC-kela-shorts` |
| 梦莱skill / 浅色编辑器 | `menglai-skill` | `E:\Admin\Documents\Playground\tui-shorts\` |
| 企鹅skill / 工业编辑 | `penguin-skill` | `E:\Admin\Desktop\zcode\RuiC-penguin-shorts\` |
| GitHub排行榜 | `github-ranking` | `RuiC-github-trending/` |
| GitHub排行榜2 / CRT 榜单 | `github-trending-2` | `E:\Admin\Desktop\zcode\RuiC-github-trending-2\` |

## 五、什么时候才回来用本引擎

只有这几样 Remotion 那边没有现成实现、而本引擎已经跑通的：

- **点云 3D 写实**：参数曲面密采样 → 按深度排序散射，遮挡精确，自带刻线质感（`engine/three.py`）
- **印刷分色**：明暗切块 + 负片网点 + 乘法定律叠印 + 套准偏移（`engine/core.py` + `print-pipeline.md`）
- **颜色是被算出来的**：比如按普朗克定律从温度反解真彩色（黑体 → CIE 1931 → sRGB）
- **合成器配乐**：FFT 时变滤波、磁带抖晃、无采样（`engine/dsp.py`）
- **亚像素级的老胶片质感**：halation 暖红环、片门微抖、两级银盐颗粒

要用的时候，**先把 `performance.md` 读一遍**——那里有这一帧到底花在哪，
以及"上显卡到底能省多少"的实测数（答案是：算子 40× ≠ 整帧 40×，整帧只 1.45×，
因为大头在 PIL 的 CPU 光栅化上）。
