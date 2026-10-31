import React from 'react';
import { C, F, MONO } from '../theme';
import { MiniSparkle } from './Sparkle';
import { SCENES, TOTAL_FRAMES, timecode } from '../data/timeline';
import { clamp, norm } from '../lib/anim';

/**
 * 常驻 HUD：四角括号 + 品牌角标 + 时间码 + 进度轨。
 * 全片硬切很多，靠这一层不动的"取景器"把镜头缝在一起。
 */
export const Chrome: React.FC<{ f: number; index: number; dim?: number }> = ({ f, index, dim = 1 }) => {
  const scene = SCENES[index];
  const local = f - scene.start;
  const nameIn = norm(local, 0, 14);
  const nameOut = 1 - norm(local, 34, 52);
  const nameA = Math.min(nameIn, Math.max(0, nameOut)) * (index === 0 ? 0 : 1);
  const railW = 300;
  const progress = clamp(f / (TOTAL_FRAMES - 1));

  const Corner: React.FC<{ left?: boolean; top?: boolean }> = ({ left, top }) => {
    const edge: React.CSSProperties = {
      position: 'absolute',
      left: left ? 40 : undefined,
      right: left ? undefined : 40,
      top: top ? 40 : undefined,
      bottom: top ? undefined : 40,
    };
    const anchor: React.CSSProperties = {
      position: 'absolute',
      left: left ? 0 : undefined,
      right: left ? undefined : 0,
      top: top ? 0 : undefined,
      bottom: top ? undefined : 0,
    };
    return (
      <div style={{ ...edge, width: 46, height: 46 }}>
        <div style={{ ...anchor, width: 46, height: 1, background: 'rgba(220,232,255,0.34)' }} />
        <div style={{ ...anchor, width: 1, height: 46, background: 'rgba(220,232,255,0.34)' }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: dim }}>
      <Corner left top />
      <Corner top />
      <Corner left />
      <Corner />

      {/* 左右边缘刻度 */}
      {Array.from({ length: 17 }).map((_, i) => (
        <div
          key={`l${i}`}
          style={{
            position: 'absolute',
            left: 40,
            top: 120 + i * 47,
            width: i % 4 === 0 ? 14 : 7,
            height: 1,
            background: `rgba(220,232,255,${i % 4 === 0 ? 0.28 : 0.14})`,
          }}
        />
      ))}
      {Array.from({ length: 17 }).map((_, i) => (
        <div
          key={`r${i}`}
          style={{
            position: 'absolute',
            right: 40,
            top: 120 + i * 47,
            width: i % 4 === 0 ? 14 : 7,
            height: 1,
            background: `rgba(220,232,255,${i % 4 === 0 ? 0.28 : 0.14})`,
            transform: 'translateX(100%)',
          }}
        />
      ))}

      {/* 左上：品牌 */}
      <div style={{ position: 'absolute', left: 72, top: 66, display: 'flex', alignItems: 'center', gap: 12 }}>
        <MiniSparkle size={16} color={C.blueHi} opacity={0.95} />
        <div style={{ ...MONO(15, 0.68, '0.34em'), fontFamily: F.display, fontWeight: 600 }}>DEEPSEEK</div>
      </div>

      {/* 右上：技术参数 */}
      <div style={{ position: 'absolute', right: 72, top: 66, textAlign: 'right', ...MONO(13, 0.44, '0.30em') }}>
        <div>DS · MOTION REEL 001</div>
        <div style={{ marginTop: 6, color: 'rgba(220,232,255,0.24)' }}>24.000S · 60FPS · 1080P</div>
      </div>

      {/* 左下：时间码 + 片名轨 */}
      <div style={{ position: 'absolute', left: 72, bottom: 68 }}>
        <div style={{ ...MONO(14, 0.55, '0.22em'), fontVariantNumeric: 'tabular-nums' }}>
          {timecode(f)} <span style={{ color: 'rgba(220,232,255,0.22)' }}>· F{String(Math.floor(f)).padStart(4, '0')}</span>
        </div>
        <div style={{ ...MONO(11, 0.26, '0.34em'), marginTop: 7 }}>THINK DEEPER, OUT LOUD</div>
      </div>

      {/* 右下：进度轨 + 场次 */}
      <div style={{ position: 'absolute', right: 72, bottom: 66, width: railW }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div style={{ ...MONO(11, 0.30, '0.28em') }}>{String(index + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}</div>
          <div style={{ ...MONO(11, 0.55, '0.26em'), color: `rgba(220,232,255,${0.35 + nameA * 0.45})` }}>
            {scene.name}
          </div>
        </div>
        <div style={{ position: 'relative', height: 2, background: 'rgba(220,232,255,0.16)' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: 2,
              width: railW * progress,
              background: `linear-gradient(90deg, rgba(61,64,254,0.8), ${C.ice})`,
              boxShadow: '0 0 12px rgba(61,64,254,0.9)',
            }}
          />
          {SCENES.map((s) => (
            <div
              key={s.id}
              style={{
                position: 'absolute',
                left: (s.start / TOTAL_FRAMES) * railW,
                top: -3,
                width: 1,
                height: 8,
                background: 'rgba(220,232,255,0.30)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
