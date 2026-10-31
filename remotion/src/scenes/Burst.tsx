import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { GlowSparkle } from '../components/Sparkle';
import { Shockwave } from '../components/Atmosphere';
import { eoBack, eoQuint, hash, norm, shakeXY } from '../lib/anim';

/**
 * 07 · BURST（14–16s）
 * 一次真实的"炸"：190 颗星尘从中心甩出去，冲击环三层错开，
 * 星芒本体留在原地当支点 —— 有中心才不散。
 */
const PARTS = Array.from({ length: 240 }, (_, i) => ({
  a: hash(i * 1.7) * Math.PI * 2,
  sp: 0.26 + hash(i * 3.1) * 1.5,
  sz: 1.1 + hash(i * 5.3) * 3.2,
  h: hash(i * 7.9),
}));

export const Burst: React.FC<{ f: number }> = ({ f }) => {
  const sh = shakeXY(f, 40 * Math.exp(-f / 12), 31, 2.2);
  const dist = (i: number) => PARTS[i].sp * 840 * eoQuint(norm(f, 0, 54));
  const fade = 1 - norm(f, 8, 68);
  const spScale = 0.55 + 0.45 * eoBack(norm(f, 0, 18), 2.4);
  const outP = norm(f, 108, 120);

  return (
    <Camera x={sh.x} y={sh.y} scale={1 + 0.04 * outP} blur={5 * outP}>
      {/* 中心爆闪 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.9 * Math.pow(1 - norm(f, 0, 12), 2)}) 0%, rgba(61,64,254,${0.5 * Math.pow(1 - norm(f, 0, 22), 2)}) 30%, rgba(61,64,254,0) 62%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 中心的软光（不用 blur 滤镜：软件光栅化下会露矩形边） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1500,
          height: 1000,
          marginLeft: -750,
          marginTop: -500,
          background:
            'radial-gradient(ellipse at center, rgba(61,64,254,0.30) 0%, rgba(61,64,254,0.12) 34%, rgba(61,64,254,0) 66%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 冲击环 */}
      <Shockwave p={norm(f, -2, 44)} max={1150} color="110,113,255" />
      <Shockwave p={norm(f, 3, 52)} max={1320} w={1.2} />
      <Shockwave p={norm(f, 8, 62)} max={1480} color="110,113,255" w={1} />

      {/* 星尘 */}
      {PARTS.map((p, i) => {
        const d = dist(i);
        const ang = p.a + f * 0.006 * (0.5 + p.h);
        const x = Math.cos(ang) * d;
        const y = Math.sin(ang) * d * 0.92;
        const streak = 3 + p.h * 9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 + x,
              top: 540 + y,
              width: p.sz * (1 + streak * 0.35),
              height: p.sz,
              borderRadius: 4,
              background: p.h > 0.62 ? C.blueHi : C.ice,
              boxShadow: `0 0 ${8 + p.sz * 4}px rgba(61,64,254,0.85)`,
              transform: `rotate(${(ang * 180) / Math.PI}deg)`,
              opacity: Math.max(0, fade) * (0.35 + 0.65 * p.h),
            }}
          />
        );
      })}

      {/* 星芒支点 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${spScale})`,
        }}
      >
        <GlowSparkle size={306} rot={f * 0.55} id="burstSp" glow={1.9} />
      </div>

      {/* 文字 */}
      <div style={{ position: 'absolute', left: 300, top: 232, opacity: norm(f, 22, 40) }}>
        <div style={{ ...MONO(13, 0.6, '0.44em') }}>OPEN TO EVERYONE</div>
        <div style={{ ...MONO(11, 0.32, '0.34em'), marginTop: 12 }}>
          {`${Math.round(eoQuint(norm(f, 22, 100)) * 100)}% REASONED IN THE OPEN`}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 300, bottom: 232, textAlign: 'right', opacity: norm(f, 40, 60), ...MONO(12, 0.42, '0.4em') }}>
        NO GATEKEEPING
      </div>
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 210,
          height: 1,
          width: 260 * norm(f, 30, 110),
          background: 'linear-gradient(90deg, rgba(110,113,255,0.9), rgba(110,113,255,0))',
        }}
      />
    </Camera>
  );
};
