import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera, Trail } from '../components/Fx';
import { Logo } from '../components/Logo';
import { Shockwave } from '../components/Atmosphere';
import { eioCubic, eoBack, eoExpo, eoQuint, lerp, norm, shakeXY } from '../lib/anim';

/**
 * 10 · IMPACT（20–22s）
 * 落点。主标从 1.62 倍砸到位，两条发丝线向两侧拉出去把版面钉住。
 */
export const Impact: React.FC<{ f: number }> = ({ f }) => {
  const slam = eoBack(norm(f, 0, 13), 1.25);
  const sh = shakeXY(f, 15 * Math.exp(-f / 14), 61, 2.1);
  const ruleW = 1000 * eoExpo(norm(f, 12, 34));
  const tag = eoExpo(norm(f, 54, 74));
  const sheenP = norm(f, 44, 74);
  const sheen = sheenP > 0 && sheenP < 1 ? eioCubic(sheenP) : undefined;
  const outP = norm(f, 110, 120);

  return (
    <Camera x={sh.x} y={sh.y} scale={lerp(1, 1.03, norm(f, 0, 120))} blur={5 * outP}>
      {/* 撞击闪 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 46%, rgba(255,255,255,${0.95 * Math.pow(1 - norm(f, 0, 9), 2)}) 0%, rgba(61,64,254,${0.55 * Math.pow(1 - norm(f, 0, 18), 2)}) 34%, rgba(61,64,254,0) 68%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 冲击环 */}
      <div style={{ position: 'absolute', top: 60 }}>
        <Shockwave p={norm(f, -3, 42)} max={1050} />
        <Shockwave p={norm(f, 2, 46)} max={1180} w={1} />
      </div>

      {/* 背后的蓝雾 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 500,
          width: 1400,
          height: 700,
          marginLeft: -700,
          marginTop: -350,
          background: 'radial-gradient(ellipse at center, rgba(61,64,254,0.42) 0%, rgba(61,64,254,0.12) 44%, rgba(61,64,254,0) 72%)',
          mixBlendMode: 'screen',
          opacity: 0.9,
        }}
      />

      {/* 主标 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
        }}
      >
        <div
          style={{
            opacity: norm(f, 0, 3),
            transform: `translateY(-34px) scale(${lerp(1.62, 1, slam)})`,
            filter: `blur(${lerp(26, 0, eoQuint(norm(f, 0, 12)))}px)`,
          }}
        >
          <Trail dx={-96} dy={0} n={3} blur={20} opacity={0.45 * (1 - norm(f, 4, 22))}>
            <Logo size={132} id="logoSp" glow={1.35} sheen={sheen} />
          </Trail>
        </div>
      </div>

      {/* 上下发丝线 */}
      {[-1, 1].map((d) => (
        <div
          key={d}
          style={{
            position: 'absolute',
            left: '50%',
            top: 500 + d * 116,
            width: ruleW,
            height: 1,
            marginLeft: -ruleW / 2,
            background:
              'linear-gradient(90deg, rgba(220,232,255,0) 0%, rgba(220,232,255,0.55) 12%, rgba(220,232,255,0.55) 88%, rgba(220,232,255,0) 100%)',
          }}
        />
      ))}
      {[-1, 1].map((d) =>
        [-1, 1].map((s) => (
          <div
            key={`${d}-${s}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: 500 + d * 116 - 8,
              width: 1,
              height: 17,
              marginLeft: (s * ruleW) / 2,
              background: 'rgba(220,232,255,0.5)',
              opacity: norm(f, 28, 40),
            }}
          />
        )),
      )}

      {/* 标语 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 700,
          textAlign: 'center',
          opacity: tag,
          transform: `translateY(${lerp(12, 0, tag)}px)`,
          fontFamily: F.display,
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: '0.52em',
          color: 'rgba(220,232,255,0.9)',
          textShadow: '0 0 34px rgba(61,64,254,0.75)',
        }}
      >
        THINK DEEPER, OUT LOUD
      </div>

      {/* 两侧角标 */}
      <div style={{ position: 'absolute', left: 300, top: 740, opacity: norm(f, 26, 44) * 0.75, ...MONO(11, 0.42, '0.4em') }}>
        OPEN WEIGHTS
      </div>
      <div style={{ position: 'absolute', right: 300, top: 740, textAlign: 'right', opacity: norm(f, 26, 44) * 0.75, ...MONO(11, 0.42, '0.4em') }}>
        MOTION REEL 001
      </div>
    </Camera>
  );
};
