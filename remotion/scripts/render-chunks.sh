#!/usr/bin/env bash
# 分段渲染 -> 拼接 -> 混入配乐。
#
# 为什么要分段：Remotion 单进程跑过 ~900 帧后，字体加载的 delayRender 偶尔会挂死
# （实测 180s 超时，报 "Loading font ... was called but not cleared"）。
# 每段 240 帧、失败自动重试，比整片一把跑稳得多。
#
#   npm run score      # 先合成配乐
#   bash scripts/render-chunks.sh
set -u
cd "$(dirname "$0")/.."
mkdir -p out

TOTAL=$(node scripts/frames.mjs)
STEP=${STEP:-240}
I=0
while [ $((I * STEP)) -lt "$TOTAL" ]; do
  S=$((I * STEP)); E=$((S + STEP - 1))
  if [ "$E" -ge "$TOTAL" ]; then E=$((TOTAL - 1)); fi
  NAME=$(printf "out/chunk%02d.mp4" "$I")
  OK=0
  for TRY in 1 2 3 4; do
    rm -f "$NAME"
    npx --no-install remotion render src/index.ts Reel "$NAME"       --frames="$S-$E" --concurrency=2 --timeout=200000 --muted >"out/chunk$I.log" 2>&1
    if [ -s "$NAME" ]; then echo "chunk $I [$S-$E] ok (try $TRY)"; OK=1; break; fi
    echo "chunk $I [$S-$E] FAILED try $TRY"
  done
  if [ "$OK" -eq 0 ]; then echo "ABORT at chunk $I"; exit 1; fi
  I=$((I + 1))
done

N=$I
: > out/list.txt
for ((K = 0; K < N; K++)); do printf "file 'chunk%02d.mp4'
" "$K" >> out/list.txt; done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i out/list.txt -c copy out/video-only.mp4
ffmpeg -hide_banner -loglevel error -y -i out/video-only.mp4 -i public/audio/score.wav   -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart out/reel.mp4
rm -f out/video-only.mp4 out/list.txt
echo "done -> out/reel.mp4  ($TOTAL frames)"
