# Remotion route — 24 秒动效宣传片

1920×1080 / 60fps / **12 小节 @ 120 BPM = 24.000 秒 = 1440 帧**。
画面是 React 组件，配乐是纯 JS 合成器，两条线读同一张 `cues.json` —— 所以每一次撞击
都落在切点帧上，不存在音画偏移。没有素材图、没有采样音、没有生成模型。

```
npm install
npm run score      # 合成配乐 -> public/audio/score.wav（24s，48kHz）
npm run dev        # Remotion Studio 预览
npm run chunks     # 分段渲染 + 拼接 + 混音 -> out/reel.mp4
```

## 结构

```
src/data/cues.json      fps / bpm / bars + 12 个场次的起始帧（唯一时间真相）
src/data/timeline.ts    由上面三个数推出 BAR / BEAT / TOTAL_FRAMES
src/scenes/*.tsx        12 个场景，每个都是 (f) => JSX 的纯函数
src/components/         HUD、终端、星芒、拖影、相机、影调
scripts/score.mjs       手写合成器（加法锯齿 / biquad / Schroeder 混响 / 侧链）
scripts/render-chunks.sh 分段渲染（见下面"为什么要分段"）
```

## 改片长

`cues.json` 里就两个数：

```json
{ "fps": 60, "bpm": 120, "bars": 12 }
```

片长 = `bars × 4 × 60 / bpm` 秒，帧数 = `bars × 4 × 60 / bpm × fps`。
常见组合：**24 s → 12 bars @120**、**30 s → 10 bars @80**、**45 s → 12 bars @64**、**60 s → 15 bars @60**。

⚠️ **三件事必须一起改**：`bars`、`SCENES` 里能铺满这些小节、以及 `scripts/score.mjs`
的编曲段落表（它是手写的"第几小节进鼓、第几小节蓄力"，不是参数）。

## 换品牌

只有三处：`src/theme.ts` 的色板、`src/components/Logo.tsx` 的锁标、各场景里的文案。
片内所有文字都写死在场景里，用 `grep -rn "旧文案" src/` 能一次找全。

## 为什么要分段渲染

Remotion 单进程跑过 ~900 帧后，字体加载的 `delayRender` 会挂住（180s 后报
`Loading font ... was called but not cleared`）。分 240 帧一段、失败自动重试，
再用 ffmpeg concat 拼接 + 混入 WAV，实测整片 5~6 分钟。

## 三个渲染坑（深色底 + 半透明层才会遇到）

1. **半透明大字号 + `transform`** → 软件光栅化按"黑底预乘"合成，出一块暗矩形。
2. **`opacity` 和 `filter` 挂同一层** → 漏矩形边。透明度要写进 `filter` 链
   （`blur(x) opacity(y)`）。
3. **硬边矩形当"光扫"** → 深底上就是一块白板。把高光用 `background-clip: text`
   贴进笔画（见 `Logo` 的 `sheen`），或加足够大的模糊 + `screen`。

## 和 Python 引擎的分工

| 要做的 | 用哪条 |
|---|---|
| 大量 HUD / 终端 / 动字 / 粒子 / 玻璃面板 | **这条**（DOM + CSS 便宜，60fps 也没压力） |
| 印刷分色、点云 3D、普朗克真彩色、物理反解的颜色 | 上层 Python 引擎（`engine/`） |
