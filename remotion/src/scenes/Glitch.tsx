import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { clamp, eoExpo, hash, lerp, norm, shakeXY } from '../lib/anim';

/**
 * 06 · GLITCH（12–14s）
 * 把字切碎再拼回来：三条切片带各自错位，蓝/冰双色分离，底下一层十六进制雨。
 * 这一段是全片唯一的"失控"，所以它必须看起来像信号坏了，而不是排版坏了。
 */
const HEX = '0123456789ABCDEF';

const Word: React.FC<{ dx?: number; color?: string; blend?: 'screen' | 'normal'; op?: number; stroke?: boolean; scale?: number }> = ({
  dx = 0,
  color = C.white,
  blend = 'normal',
  op = 1,
  stroke = false,
  scale = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      transform: `translateX(${dx}px) scale(${scale})`,
      mixBlendMode: blend,
      opacity: op,
    }}
  >
    <div
      style={{
        fontFamily: F.display,
        fontWeight: 800,
        fontSize: 228,
        lineHeight: 0.86,
        letterSpacing: '-0.05em',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        color: stroke ? 'transparent' : color,
        WebkitTextStroke: stroke ? '2px rgba(220,232,255,0.55)' : undefined,
        textShadow: stroke ? 'none' : '0 0 60px rgba(61,64,254,0.55)',
      }}
    >
      DEEP
      <br />
      SEEK
    </div>
  </div>
);

export const Glitch: React.FC<{ f: number }> = ({ f }) => {
  const punch = 1 + 0.045 * Math.pow(1 - eoExpo(norm(f % 15, 0, 9)), 2);
  const sh = shakeXY(f, 4 + 7 * (1 - norm(f, 0, 30)), 21, 2.4);
  const inv = (f >= 58 && f <= 60) || (f >= 101 && f <= 102) || (f >= 114 && f <= 115);
  const outP = norm(f, 112, 120);

  return (
    <Camera x={sh.x} y={sh.y} scale={punch} blur={4 * outP}>
      {/* 十六进制雨 */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
        {Array.from({ length: 10 }).map((_, c) => {
          const speed = 2 + hash(c * 7.3) * 5.5;
          return Array.from({ length: 18 }).map((_, r) => {
            const y = ((r * 66 + f * speed + c * 90) % 1180) - 50;
            const ch = HEX[Math.floor(hash(c * 31 + r * 7 + Math.floor(f / 2)) * 16)];
            return (
              <div
                key={`${c}-${r}`}
                style={{
                  position: 'absolute',
                  left: 128 + c * 176,
                  top: y,
                  fontFamily: F.mono,
                  fontSize: 15,
                  letterSpacing: '0.1em',
                  color: 'rgba(61,64,254,0.85)',
                  opacity: 0.25 + 0.5 * hash(c * 3 + r),
                }}
              >
                {ch}
              </div>
            );
          });
        })}
      </div>

      {/* 双色分离 */}
      <Word dx={lerp(4, 9, hash(f * 0.3))} color="rgba(110,113,255,0.62)" blend="screen" />
      <Word dx={-lerp(4, 9, hash(f * 0.3 + 5))} color="rgba(220,232,255,0.5)" blend="screen" />

      {/* 主字 */}
      <Word dx={(hash(f * 9.1) - 0.5) * 6} />

      {/* 切片带：同一段文字横向错位 */}
      {[0, 1, 2].map((b) => {
        const y = hash(f * 4.1 + b * 17) * 1020;
        const h = 26 + hash(f * 2.3 + b) * 76;
        const dx = (hash(f * 6.7 + b * 3.1) - 0.5) * 120;
        return (
          <div key={b} style={{ position: 'absolute', left: 0, top: y, width: 1920, height: h, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: -y, width: 1920, height: 1080 }}>
              <Word dx={dx} color={b === 1 ? C.blueHi : C.white} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 1920,
                height: h,
                background: `rgba(61,64,254,${0.10 + 0.12 * hash(f + b)})`,
                mixBlendMode: 'screen',
              }}
            />
          </div>
        );
      })}

      {/* 撕裂亮条 */}
      {[0, 1, 2, 3].map((i) => {
        const y = hash(f * 3.3 + i * 11.7) * 1080;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: y,
              width: 1920,
              height: i % 2 === 0 ? 2 : 1,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(110,113,255,0.7)',
              opacity: 0.35 + 0.5 * hash(f * 1.9 + i),
              boxShadow: '0 0 24px rgba(61,64,254,0.9)',
            }}
          />
        );
      })}

      {/* 扫掠线 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: (f * 19) % 1080,
          width: 1920,
          height: 3,
          background: 'linear-gradient(180deg, rgba(220,232,255,0) 0%, rgba(220,232,255,0.45) 50%, rgba(220,232,255,0) 100%)',
          filter: 'blur(1px)',
        }}
      />

      {/* 反相帧 */}
      {inv ? <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', mixBlendMode: 'difference' }} /> : null}

      {/* 角标 */}
      <div style={{ position: 'absolute', left: 300, top: 200, ...MONO(12, 0.5, '0.44em') }}>
        <div style={{ color: C.blueHi }}>● SIGNAL FAULT</div>
        <div style={{ marginTop: 12, opacity: 0.6 }}>{`PACKET ${String(Math.floor(f * 3.7)).padStart(5, '0')} DROPPED`}</div>
      </div>
      <div style={{ position: 'absolute', right: 300, bottom: 200, textAlign: 'right', ...MONO(12, 0.45, '0.4em') }}>
        <div>RECOVERING…</div>
        <div style={{ marginTop: 10, color: C.blueHi }}>{`${Math.round(clamp(norm(f, 0, 118)) * 100)}%`}</div>
      </div>

      {/* 进度条 */}
      <div style={{ position: 'absolute', left: 300, bottom: 176, width: 260, height: 2, background: 'rgba(220,232,255,0.14)' }}>
        <div style={{ width: 260 * clamp(norm(f, 0, 118)), height: 2, background: C.blueHi, boxShadow: '0 0 14px rgba(61,64,254,0.95)' }} />
      </div>
    </Camera>
  );
};
