import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { C } from './theme';
import { SCENES, sceneIndexAt } from './data/timeline';
import { Backdrop, Grade, Flash } from './components/Atmosphere';
import { Chrome } from './components/Chrome';
import { Ignite } from './scenes/Ignite';
import { Boot } from './scenes/Boot';
import { Kinetic } from './scenes/Kinetic';
import { Neural } from './scenes/Neural';
import { Hud } from './scenes/Hud';
import { Cyclone } from './scenes/Cyclone';
import { Glitch } from './scenes/Glitch';
import { Burst } from './scenes/Burst';
import { Montage } from './scenes/Montage';
import { Build } from './scenes/Build';
import { Impact } from './scenes/Impact';
import { Finale } from './scenes/Finale';

const COMP: Record<string, React.FC<{ f: number }>> = {
  ignite: Ignite,
  boot: Boot,
  kinetic: Kinetic,
  neural: Neural,
  hud: Hud,
  cyclone: Cyclone,
  glitch: Glitch,
  burst: Burst,
  montage: Montage,
  build: Build,
  impact: Impact,
  finale: Finale,
};

/** 每一场给背景一个不同的光位/网格浓度，硬切才不会像同一张底图 */
const BG: Record<string, { gx: number; gy: number; glow: number; grid: number }> = {
  ignite: { gx: 0.5, gy: 0.5, glow: 1.0, grid: 1.0 },
  boot: { gx: 0.42, gy: 0.52, glow: 0.8, grid: 1.1 },
  kinetic: { gx: 0.5, gy: 0.52, glow: 1.35, grid: 0.55 },
  neural: { gx: 0.5, gy: 0.5, glow: 0.9, grid: 0.5 },
  hud: { gx: 0.5, gy: 0.5, glow: 0.75, grid: 0.9 },
  cyclone: { gx: 0.5, gy: 0.5, glow: 0.8, grid: 0.3 },
  glitch: { gx: 0.5, gy: 0.5, glow: 1.15, grid: 0.35 },
  burst: { gx: 0.5, gy: 0.5, glow: 1.7, grid: 0.22 },
  montage: { gx: 0.5, gy: 0.5, glow: 0.85, grid: 0.6 },
  build: { gx: 0.5, gy: 0.5, glow: 1.5, grid: 0.28 },
  impact: { gx: 0.5, gy: 0.46, glow: 1.4, grid: 0.45 },
  finale: { gx: 0.5, gy: 0.44, glow: 1.1, grid: 0.32 },
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = sceneIndexAt(frame);
  const scene = SCENES[idx];
  const local = frame - scene.start;
  const Scene = COMP[scene.id];
  const bg = BG[scene.id];

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy0, overflow: 'hidden' }}>
      <Backdrop f={frame} glowX={bg.gx} glowY={bg.gy} glow={bg.glow} grid={bg.grid} />
      <Scene f={local} />
      <Chrome f={frame} index={idx} dim={scene.id === 'finale' ? 0.4 : scene.id === 'impact' ? 0.6 : 1} />
      <Grade f={frame} grain={scene.id === 'finale' ? 0.8 : 1} />
      {idx > 0 ? <Flash f={local} at={0} len={4} peak={0.22} /> : null}
      <Audio src={staticFile('audio/score.wav')} />
    </AbsoluteFill>
  );
};
