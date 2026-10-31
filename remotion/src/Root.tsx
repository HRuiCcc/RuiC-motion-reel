import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { FPS, TOTAL_FRAMES } from './data/timeline';
import { L } from './theme';
import { ensureFonts } from './fonts';

ensureFonts();

/**
 * AI In Public · Motion Reel 001
 * 1920×1080 @ 60fps / 24.000s / 1440 帧 —— 120 BPM × 12 小节，音画同一张 cue 表。
 */
export const RemotionRoot: React.FC = () => (
  <Composition id="Reel" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={L.w} height={L.h} />
);
