import cues from './cues.json';

export type SceneDef = { id: string; start: number; name: string };

/**
 * 时间网格全部从 cues.json 的三个数推出来：fps / bpm / bars。
 *   片长   = bars × 4 × 60 / bpm 秒
 *   一小节 = 4 × 60 / bpm × fps 帧
 * 这套数和 scripts/score.mjs 用的是同一组，改一个必须改另一个（编曲是手写的段落表）。
 */
export const FPS = cues.fps;
export const BPM = cues.bpm;
export const BARS = cues.bars;

/** 一小节多少帧（整数最干净；不是整数也能跑，但切点会落半帧） */
export const BAR = Math.round(((60 / BPM) * 4) * FPS);
export const BEAT = BAR / 4;
export const EIGHTH = BAR / 8;
export const SIXTEENTH = BAR / 16;
export const TOTAL_FRAMES = BAR * BARS;

export const SCENES = cues.scenes as SceneDef[];
export const HITS = cues.hits;

export const sceneIndexAt = (f: number): number => {
  let idx = 0;
  for (let i = 0; i < SCENES.length; i++) if (f >= SCENES[i].start) idx = i;
  return idx;
};

export const framesToSec = (f: number): number => f / FPS;

/** 00:00:00 形式的时间码（用于常驻 HUD） */
export const timecode = (f: number): string => {
  const total = Math.floor(f);
  const ff = total % FPS;
  const s = Math.floor(total / FPS);
  const ss = s % 60;
  const mm = Math.floor(s / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return `00:${p(mm)}:${p(ss)}:${p(ff)}`;
};
