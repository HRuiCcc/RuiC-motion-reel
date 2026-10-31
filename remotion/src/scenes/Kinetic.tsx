import React from 'react';
import { C, F, MONO } from '../theme';
import { Trail } from '../components/Fx';
import { Camera } from '../components/Fx';
import { eiCubic, eoQuint, hash, lerp, norm, shakeXY } from '../lib/anim';

/**
 * 02 · KINETIC（4–6s）
 * 一拍一个字，四个字把主张砸完：LEARN · AI · OUT · LOUD.
 * 每个字都带定向拖影 + 蓝底反白 + 描边三种质感轮着来。
 */
const WORDS = [
  { t: 'DEEP', size: 300, kind: 'solid' as const },
  { t: 'SEEK', size: 360, kind: 'slab' as const },
  { t: 'THINK', size: 320, kind: 'outline' as const },
  { t: 'DEEPER.', size: 268, kind: 'solid' as const },
];
const SLAMS = [0, 30, 60, 90];

export const Kinetic: React.FC<{ f: number }> = ({ f }) => {
  let amp = 0;
  let seed = 0;
  SLAMS.forEach((s, i) => {
    if (f >= s) {
      const a = 11 * Math.exp(-(f - s) / 8);
      if (a > amp) {
        amp = a;
        seed = i;
      }
    }
  });
  const sh = shakeXY(f, amp, seed + 3, 1.7);
  const z = 1 + 0.03 * (amp / 11);

  return (
    <Camera x={sh.x} y={sh.y} scale={z}>
      {WORDS.map((w, i) => {
        const s = SLAMS[i];
        const din = norm(f, s, s + 10);
        if (f < s || din <= 0) return null;
        const pin = eoQuint(din);
        const q = norm(f, s + 23, s + 34);
        const op = norm(f, s, s + 3) * (1 - q);
        if (op <= 0.001) return null;
        const scale = lerp(1.62, 1, pin) * (1 + 0.06 * eiCubic(q));
        const blur = lerp(20, 0, pin) + 10 * q;
        const driftY = (i % 2 === 0 ? -1 : 1) * 26;

        const text = (
          <div
            style={{
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: w.size,
              lineHeight: 0.86,
              letterSpacing: '-0.045em',
              color: w.kind === 'outline' ? 'transparent' : C.white,
              WebkitTextStroke: w.kind === 'outline' ? '2px rgba(220,232,255,0.92)' : undefined,
              textShadow:
                w.kind === 'outline'
                  ? '0 0 70px rgba(61,64,254,0.55)'
                  : '0 0 40px rgba(61,64,254,0.65), 0 0 140px rgba(61,64,254,0.45)',
              whiteSpace: 'nowrap',
            }}
          >
            {w.t}
          </div>
        );

        return (
          <React.Fragment key={i}>
            {/* 背后的蓝色光雾 */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 1500,
                height: 900,
                marginLeft: -750,
                marginTop: -450,
                background: `radial-gradient(circle at 50% 50%, rgba(61,64,254,${0.36 * pin * (1 - q * 0.7)}) 0%, rgba(61,64,254,0.10) 42%, rgba(61,64,254,0) 70%)`,
                mixBlendMode: 'screen',
              }}
            />

            {/* 速度线 */}
            <div style={{ position: 'absolute', inset: 0, opacity: (1 - pin) * 0.9 }}>
              {Array.from({ length: 9 }).map((_, j) => {
                const y = 150 + hash(j * 3.7 + i) * 780;
                const len = 180 + hash(j * 5.1 + i * 2) * 420;
                const x = 1500 - ((f - s) * (46 + j * 9) + j * 130) % 2400;
                return (
                  <div
                    key={j}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      width: len,
                      height: j % 3 === 0 ? 2 : 1,
                      background: 'linear-gradient(90deg, rgba(220,232,255,0), rgba(220,232,255,0.75), rgba(220,232,255,0))',
                    }}
                  />
                );
              })}
            </div>

            {/* 主字 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                opacity: op,
              }}
            >
              <Trail dx={-118} dy={0} n={4} blur={17} opacity={0.42 * op}>
                <div
                  style={{
                    transform: `translateY(${driftY}px) scale(${scale})`,
                    filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                  }}
                >
                  {w.kind === 'slab' ? (
                    <div
                      style={{
                        background: C.blue,
                        padding: '18px 64px 34px',
                        boxShadow: '0 0 90px rgba(61,64,254,0.85), 0 0 220px rgba(61,64,254,0.45)',
                      }}
                    >
                      {text}
                    </div>
                  ) : (
                    text
                  )}
                </div>
              </Trail>
            </div>

            {/* 序号角标 */}
            <div
              style={{
                position: 'absolute',
                left: 300,
                top: 336,
                opacity: op * 0.85,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ ...MONO(13, 0.7, '0.3em') }}>0{i + 1}</div>
              <div style={{ width: 46, height: 1, background: 'rgba(220,232,255,0.5)' }} />
              <div style={{ ...MONO(11, 0.35, '0.4em') }}>04</div>
            </div>
          </React.Fragment>
        );
      })}

      {/* 右下角标记 */}
      <div style={{ position: 'absolute', right: 300, bottom: 336, ...MONO(11, 0.28, '0.42em') }}>KINETIC TYPE / 120 BPM</div>
    </Camera>
  );
};
