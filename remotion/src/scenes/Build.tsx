import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera, SpeedLines, chroma } from '../components/Fx';
import { eiCubic, eioCubic, eoExpo, hash, lerp, norm, shakeXY } from '../lib/anim';

/**
 * 09 · BUILD（18–20s）
 * 所有环收成一个眼；字开始抖到看不清；最后 8 帧过曝。
 * 这一场的唯一任务是把观众按到椅背上。
 */
const CYCLE = ['DEEP', 'SEEK', 'THINK'];

export const Build: React.FC<{ f: number }> = ({ f }) => {
  const k = eioCubic(norm(f, 0, 112));
  const exposure = Math.pow(norm(f, 94, 118), 1.7);
  const sh = shakeXY(f, 2 + 13 * eiCubic(norm(f, 30, 118)), 51, 2.6);
  const step = f < 84 ? 7 : 3;
  const wi = Math.floor(f / step) % 3;
  const chromaPx = 1.5 + 15 * Math.pow(norm(f, 62, 112), 1.4);
  const rings = Array.from({ length: 9 }, (_, i) => {
    const base = 1040 - i * 74;
    const r = lerp(base, 54 + i * 20, k);
    return { r, i };
  });

  return (
    <Camera x={sh.x} y={sh.y} scale={lerp(1, 1.17, eioCubic(norm(f, 0, 118)))}>
      {/* 速度线 */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 + 0.7 * norm(f, 40, 110) }}>
        <SpeedLines f={f} count={22} opacity={0.28} />
        <SpeedLines f={f * 1.7 + 40} count={16} opacity={0.18} />
      </div>

      {/* 径向收束线 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(960 540)" opacity={0.18 + 0.5 * k}>
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2 + f * 0.004;
            const inner = 40 + 120 * k;
            return (
              <line
                key={i}
                x1={Math.cos(a) * 1500}
                y1={Math.sin(a) * 1500}
                x2={Math.cos(a) * inner}
                y2={Math.sin(a) * inner}
                stroke="rgba(110,113,255,0.35)"
                strokeWidth={0.7}
              />
            );
          })}
        </g>
      </svg>

      {/* 收缩环 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(960 540)">
          {rings.map(({ r, i }) => (
            <circle
              key={i}
              r={r}
              fill="none"
              stroke={i % 2 === 0 ? 'rgba(110,113,255,0.55)' : 'rgba(220,232,255,0.30)'}
              strokeWidth={i === 0 ? 2 : 1}
              strokeDasharray={i % 3 === 0 ? '6 14' : undefined}
            />
          ))}
        </g>
      </svg>

      {/* 中央快闪字 */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: 210,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            color: C.white,
            textShadow: chroma(chromaPx, 0.65),
            transform: `scale(${1 + 0.05 * (1 - eoExpo(norm(f % step, 0, step)))})`,
            opacity: 0.9,
          }}
        >
          {CYCLE[wi]}
        </div>
      </div>

      {/* 蓝雾 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1200,
          height: 1200,
          marginLeft: -600,
          marginTop: -600,
          background: `radial-gradient(circle, rgba(61,64,254,${0.18 + 0.45 * k}) 0%, rgba(61,64,254,0) 62%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 过曝 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.95 * exposure}) 0%, rgba(210,222,255,${0.85 * exposure}) 26%, rgba(61,64,254,${0.5 * exposure}) 52%, rgba(61,64,254,0) 76%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 读数 */}
      <div style={{ position: 'absolute', left: 300, top: 220, opacity: 1 - exposure, ...MONO(12, 0.55, '0.42em') }}>
        <div style={{ color: C.blueHi }}>● BUILDING</div>
        <div style={{ marginTop: 12 }}>{`${String(Math.round(k * 100)).padStart(3, '0')}%`}</div>
      </div>
      <div style={{ position: 'absolute', right: 300, bottom: 210, textAlign: 'right', opacity: (1 - exposure) * 0.5, ...MONO(11, 0.4, '0.4em') }}>
        <div>COMPRESSING EVERYTHING</div>
        <div style={{ marginTop: 10 }}>INTO ONE FRAME</div>
      </div>

      {/* 底部蓄力条 */}
      <div style={{ position: 'absolute', left: 300, right: 300, bottom: 176, height: 2, background: 'rgba(220,232,255,0.12)', opacity: 1 - exposure * 0.8 }}>
        <div
          style={{
            width: `${(960) * (0.06 + 0.94 * k)}px`,
            height: 2,
            background: `linear-gradient(90deg, rgba(110,113,255,0.4), ${C.white})`,
            boxShadow: '0 0 20px rgba(61,64,254,0.95)',
          }}
        />
      </div>
    </Camera>
  );
};
