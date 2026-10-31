import React from 'react';
import { C, F, MONO } from '../theme';
import { Terminal } from '../components/Terminal';
import { Camera } from '../components/Fx';
import { MiniSparkle } from '../components/Sparkle';
import { eioCubic, eoExpo, hash, lerp, norm } from '../lib/anim';

/**
 * 01 · TERMINAL（2–4s）
 * 品牌"活"在一台机器里：终端自己把身份报出来，逐字打字。
 */
const LINES = [
  '$ deepseek --init --mode=reasoning',
  '›  model.load ................. ok',
  '›  weights ................. open',
  '›  reasoning ............... deep',
  '›  status .................. READY',
];
const STARTS = [2, 26, 44, 62, 80];

export const Boot: React.FC<{ f: number }> = ({ f }) => {
  const reveal = LINES.map((ln, i) => Math.floor(norm(f, STARTS[i], STARTS[i] + 17) * ln.length));
  const inP = eoExpo(norm(f, 0, 7));
  const appear = 0.42 + 0.58 * inP;
  const outP = norm(f, 108, 120);
  const push = lerp(1.02, 1.075, eioCubic(norm(f, 0, 120)));
  const rot = lerp(-0.5, 0.25, eioCubic(norm(f, 0, 120)));
  const glitch = f > 104 && f < 110 ? (hash(f * 7.3) - 0.5) * 16 : 0;
  const done = norm(f, 100, 112);

  return (
    <Camera scale={push * (1 + 0.14 * outP)} rot={rot + outP * 0.6} x={glitch} blur={11 * outP} y={-8 * outP}>
      {/* 左侧竖标 */}
      <div style={{ position: 'absolute', left: 118, top: 300, opacity: 0.55 * inP }}>
        <div style={{ width: 1, height: 220, background: 'linear-gradient(180deg, rgba(220,232,255,0.45), rgba(220,232,255,0))' }} />
        <div style={{ ...MONO(11, 0.5, '0.44em'), marginTop: 16, marginLeft: -6, transform: 'rotate(90deg)', transformOrigin: 'left top' }}>
          TTY0 / SECURE
        </div>
      </div>

      {/* 终端 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${-96 + glitch * 0.6}px, ${lerp(30, 0, inP)}px) scale(${lerp(1.055, 1, inP) * (1 - 0.03 * outP)})`,
          opacity: appear * (1 - 0.55 * outP),
          filter: `blur(${lerp(9, 0, inP)}px)`,
        }}
      >
        <Terminal f={f} lines={LINES} reveal={reveal} width={940} fontSize={25} lineH={54} />
      </div>

      {/* 右侧竖向信号 */}
      <div
        style={{
          position: 'absolute',
          right: 92,
          top: '50%',
          transform: 'translateY(-50%) rotate(90deg)',
          transformOrigin: 'center',
          opacity: 0.5 * inP,
          ...MONO(12, 0.55, '0.62em'),
        }}
      >
        SIGNAL · LIVE · 001
      </div>
      <div style={{ position: 'absolute', right: 132, top: 300, display: 'flex', gap: 8, opacity: 0.5 * inP }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 18 + 8 * Math.abs(Math.sin(f * 0.09 + i * 1.1)),
              background: i === 0 ? C.blueHi : 'rgba(220,232,255,0.3)',
              boxShadow: i === 0 ? '0 0 14px rgba(61,64,254,0.9)' : undefined,
            }}
          />
        ))}
      </div>

      {/* 左侧完成态 */}
      <div
        style={{
          position: 'absolute',
          left: 124,
          bottom: 210,
          opacity: done,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <MiniSparkle size={18} color={C.blueHi} />
        <div style={{ ...MONO(13, 0.6, '0.34em') }}>HANDSHAKE OK · WEIGHTS LOADED</div>
      </div>

      {/* 底部说明 */}
      <div style={{ position: 'absolute', left: 124, bottom: 168, opacity: 0.6 * inP, ...MONO(11, 0.3, '0.34em') }}>
        EVERY FRAME, EVERY SOUND — WRITTEN IN CODE
      </div>

      {/* 顶部细标题 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 132, textAlign: 'center', opacity: 0.5 * inP, ...MONO(11, 0.3, '0.55em') }}>
        {(F.display + ' / ' + F.mono + ' / 60FPS').toUpperCase()}
      </div>
    </Camera>
  );
};
