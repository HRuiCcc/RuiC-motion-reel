import React from 'react';
import { C, F, MONO } from '../theme';
import { GlowSparkle } from '../components/Sparkle';
import { Camera } from '../components/Fx';
import { clamp, eioCubic, eiCubic, eoBack, eoExpo, eoQuint, hitShake, lerp, norm } from '../lib/anim';

/**
 * 00 · IGNITION（0–2s）
 * 一条发丝线把画面撑开，星芒从线心里长出来 —— 全片的第一个标点。
 */
export const Ignite: React.FC<{ f: number }> = ({ f }) => {
  const lineIn = eoExpo(norm(f, 0, 26));
  const lineOut = 1 - eiCubic(norm(f, 76, 106));
  const ruleW = 1180 * lineIn * (0.2 + 0.8 * lineOut);
  const spIn = eoBack(norm(f, 12, 38), 2.6);
  const spRot = lerp(-120, 0, eoQuint(norm(f, 12, 48)));
  const ring = norm(f, 14, 54);
  const ring2 = norm(f, 22, 66);
  const flash = Math.pow(1 - norm(f, 12, 30), 2);
  const tag = eoExpo(norm(f, 44, 66));
  const meta = eoExpo(norm(f, 60, 84));
  const push = lerp(1, 1.09, eioCubic(norm(f, 0, 120)));
  const exitScale = 1 + 0.07 * eiCubic(norm(f, 102, 120));
  const sh = hitShake(f, 96, 4.5, 8, 2);
  const exitBlur = 7 * eiCubic(norm(f, 104, 120));

  return (
    <Camera x={sh.x} y={sh.y} scale={push * exitScale} blur={exitBlur}>
      {/* 旋转刻度环 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 0.55 * lineIn }}>
        <g transform="translate(960 540)">
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i / 72) * Math.PI * 2 + f * 0.0022;
            const r1 = 322;
            const r2 = i % 6 === 0 ? 292 : 310;
            return (
              <line
                key={i}
                x1={Math.cos(a) * r1}
                y1={Math.sin(a) * r1}
                x2={Math.cos(a) * r2}
                y2={Math.sin(a) * r2}
                stroke={`rgba(220,232,255,${i % 6 === 0 ? 0.42 : 0.2})`}
                strokeWidth={1}
              />
            );
          })}
        </g>
      </svg>

      {/* 冲击环 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 300 + ring * 900,
          height: 300 + ring * 900,
          marginLeft: -(300 + ring * 900) / 2,
          marginTop: -(300 + ring * 900) / 2,
          borderRadius: '50%',
          border: '1px solid rgba(220,232,255,0.4)',
          opacity: (1 - ring) * 0.75,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 220 + ring2 * 1300,
          height: 220 + ring2 * 1300,
          marginLeft: -(220 + ring2 * 1300) / 2,
          marginTop: -(220 + ring2 * 1300) / 2,
          borderRadius: '50%',
          border: '1px solid rgba(61,64,254,0.55)',
          opacity: (1 - ring2) * 0.6,
        }}
      />

      {/* 中心发丝线 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: ruleW,
          height: 1.5,
          marginLeft: -ruleW / 2,
          marginTop: -0.75,
          background:
            'linear-gradient(90deg, rgba(220,232,255,0) 0%, rgba(220,232,255,0.7) 18%, #FFFFFF 50%, rgba(220,232,255,0.7) 82%, rgba(220,232,255,0) 100%)',
          boxShadow: '0 0 26px rgba(61,64,254,0.95)',
        }}
      />
      {/* 两端短刻线 */}
      {[-1, 1].map((d) => (
        <div
          key={d}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 1,
            height: 96 * lineIn,
            marginLeft: d * (ruleW / 2) - 0.5,
            marginTop: -48 * lineIn,
            background: 'linear-gradient(180deg, rgba(220,232,255,0), rgba(220,232,255,0.5), rgba(220,232,255,0))',
            opacity: lineOut,
          }}
        />
      ))}

      {/* 星芒 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${spIn})`,
          opacity: clamp(spIn * 1.2),
        }}
      >
        <GlowSparkle size={138} rot={spRot} id="igSp" glow={1.5} />
      </div>

      {/* 点燃闪 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 900,
          height: 900,
          marginLeft: -450,
          marginTop: -450,
          background: `radial-gradient(circle, rgba(255,255,255,${0.55 * flash}) 0%, rgba(61,64,254,${0.4 * flash}) 26%, rgba(61,64,254,0) 62%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 上标签 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'calc(50% - 178px)',
          textAlign: 'center',
          opacity: meta,
          ...MONO(12, 0.5, '0.62em'),
        }}
      >
        DEEPSEEK · 001 · SIGNAL ACQUIRED
      </div>

      {/* 下标语 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'calc(50% + 116px)',
          textAlign: 'center',
          opacity: tag,
          transform: `translateY(${lerp(10, 0, tag)}px)`,
          fontFamily: F.display,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: '0.46em',
          color: 'rgba(220,232,255,0.86)',
          textShadow: '0 0 34px rgba(61,64,254,0.7)',
        }}
      >
        THINK DEEPER, OUT LOUD
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'calc(50% + 176px)',
          textAlign: 'center',
          opacity: tag * 0.6,
          ...MONO(10, 0.4, '0.5em'),
        }}
      >
        {`// ${C.blue.replace('#', '')} · BLUE SIGNAL`}
      </div>
    </Camera>
  );
};
