import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from '../theme';
import { clamp, hash, norm } from '../lib/anim';

/** 静态颗粒贴图（一次生成，逐帧只挪位置，稳且便宜） */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.55'/></svg>\")";

export const Backdrop: React.FC<{ f: number; glowX?: number; glowY?: number; glow?: number; grid?: number }> = ({
  f,
  glowX = 0.5,
  glowY = 0.48,
  glow = 1,
  grid = 1,
}) => {
  const drift = (f / 900) * 26;
  return (
    <AbsoluteFill style={{ background: C.navy0, overflow: 'hidden' }}>
      {/* 台面：深海军蓝的放射渐变 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 80% at ${glowX * 100}% ${glowY * 100}%, #0B1248 0%, #060A2B 34%, #030518 66%, #01030C 100%)`,
        }}
      />
      {/* 主色光雾，缓慢呼吸 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(42% 40% at ${glowX * 100}% ${glowY * 100}%, rgba(61,64,254,${0.30 * glow}) 0%, rgba(61,64,254,${0.10 * glow}) 42%, rgba(61,64,254,0) 72%)`,
          mixBlendMode: 'screen',
        }}
      />
      {/* 细网格，带向心遮罩 */}
      <AbsoluteFill
        style={{
          opacity: 0.55 * grid,
          backgroundImage:
            'linear-gradient(to right, rgba(220,232,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(220,232,255,0.055) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          WebkitMaskImage: 'radial-gradient(72% 62% at 50% 50%, #000 8%, rgba(0,0,0,0.35) 55%, transparent 82%)',
          maskImage: 'radial-gradient(72% 62% at 50% 50%, #000 8%, rgba(0,0,0,0.35) 55%, transparent 82%)',
        }}
      />
      {/* 十字刻度（HUD 底噪） */}
      <AbsoluteFill style={{ opacity: 0.5 * grid }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const x = 60 + hash(i * 3.1) * 1800;
          const y = 40 + hash(i * 7.7 + 2) * 1000;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 9,
                height: 1,
                background: 'rgba(220,232,255,0.16)',
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 顶层影调：暗角 + 扫描线 + 颗粒。永远盖在画面最上面。 */
export const Grade: React.FC<{ f: number; grain?: number; scan?: number }> = ({ f, grain = 1, scan = 1 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(78% 72% at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.32) 76%, rgba(0,0,0,0.62) 100%)',
      }}
    />
    <AbsoluteFill
      style={{
        opacity: 0.5 * grain,
        backgroundImage: GRAIN,
        backgroundPosition: `${(f * 37) % 180}px ${(f * 61) % 180}px`,
        mixBlendMode: 'overlay',
      }}
    />
    <AbsoluteFill
      style={{
        opacity: 0.5 * scan,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 3px)',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(60% 50% at 50% 0%, rgba(61,64,254,0.10) 0%, rgba(61,64,254,0) 70%)',
        mixBlendMode: 'screen',
      }}
    />
  </AbsoluteFill>
);

/** 转场闪白 / 闪蓝：给硬切一个"撞击"理由 */
export const Flash: React.FC<{ f: number; at: number; len?: number; color?: string; peak?: number }> = ({
  f,
  at,
  len = 5,
  color = '255,255,255',
  peak = 0.85,
}) => {
  const p = norm(f, at, at + len);
  if (p <= 0 || p >= 1) return null;
  const a = Math.pow(1 - p, 2.2) * peak;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(70% 70% at 50% 48%, rgba(${color},${a}) 0%, rgba(${color},${a * 0.5}) 45%, rgba(${color},0) 78%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};

/** 全屏冲击环（撞击专用，纯渐变，不吃滤镜） */
export const Shockwave: React.FC<{ p: number; max?: number; color?: string; w?: number }> = ({
  p,
  max = 1100,
  color = '220,232,255',
  w = 2,
}) => {
  const q = clamp(p);
  if (q <= 0 || q >= 1) return null;
  const size = 120 + q * max;
  const fade = Math.pow(1 - q, 2.4);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        border: `${w}px solid rgba(${color},${fade * 0.6})`,
        boxShadow: `0 0 ${40 * (1 - q)}px rgba(${color},${fade * 0.4}), inset 0 0 ${60 * (1 - q)}px rgba(${color},${fade * 0.2})`,
        transform: `scale(${1 + q * 0.15})`,
      }}
    />
  );
};
