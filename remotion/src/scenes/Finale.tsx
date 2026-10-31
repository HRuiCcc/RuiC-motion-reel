import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { Logo } from '../components/Logo';
import { MiniSparkle } from '../components/Sparkle';
import { eoBack, eoExpo, eioCubic, lerp, norm } from '../lib/anim';

/**
 * 11 · FINALE（22–24s）
 * 端卡。主标呼吸，星芒绕行，一句原话落版：
 * "DEEPSEEK, thinking out loud."
 */
export const Finale: React.FC<{ f: number }> = ({ f }) => {
  const breathe = 1 + 0.007 * Math.sin(f * 0.1);
  const tiltY = 2.4 * Math.sin(f * 0.05);
  const tag = eoExpo(norm(f, 10, 34));
  const url = eoExpo(norm(f, 22, 44));
  const br = eoBack(norm(f, 52, 76), 1.5);
  const glint = Math.pow(Math.max(0, Math.sin(((f - 96) / 24) * Math.PI)), 3);

  const sweepP = (f % 50) / 20;
  const sheen = sweepP <= 1 ? eioCubic(sweepP) : undefined;

  return (
    <Camera scale={1 + 0.01 * norm(f, 0, 120)}>
      {/* 底光 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 470,
          width: 1500,
          height: 760,
          marginLeft: -750,
          marginTop: -380,
          background: 'radial-gradient(ellipse at center, rgba(61,64,254,0.34) 0%, rgba(61,64,254,0.10) 42%, rgba(61,64,254,0) 70%)',
          mixBlendMode: 'screen',
          opacity: 0.85 + 0.15 * Math.sin(f * 0.08),
        }}
      />

      {/* 主标 + 3D 呼吸 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 470,
          transform: `translate(-50%, -50%) perspective(1400px) rotateY(${tiltY}deg) rotateX(${-tiltY * 0.35}deg) scale(${breathe})`,
        }}
      >
        <Logo size={132} id="logoSp" glow={1.25} sheen={sheen} />
      </div>

      {/* 光扫已经做进字形里（Logo 的 sheen），这里不再铺光板 */}

      {/* 绕行的小星芒 */}
      <div
        style={{
          position: 'absolute',
          left: 960 + Math.cos(f * 0.055) * 430,
          top: 470 + Math.sin(f * 0.055) * 128,
          opacity: 0.9,
        }}
      >
        <MiniSparkle size={26} color={C.blueHi} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960 + Math.cos(f * 0.037 + 2.1) * 500,
          top: 470 + Math.sin(f * 0.037 + 2.1) * 150,
          opacity: 0.6,
        }}
      >
        <MiniSparkle size={14} color={C.ice} />
      </div>

      {/* 括号锁定 */}
      {[
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
      ].map((d, i) => {
        const ox = lerp(720, 560, br);
        const oy = lerp(196, 118, br);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 + d.x * ox,
              top: 470 + d.y * oy,
              width: 34,
              height: 34,
              borderTop: d.y < 0 ? '1px solid rgba(220,232,255,0.55)' : undefined,
              borderBottom: d.y > 0 ? '1px solid rgba(220,232,255,0.55)' : undefined,
              borderLeft: d.x < 0 ? '1px solid rgba(220,232,255,0.55)' : undefined,
              borderRight: d.x > 0 ? '1px solid rgba(220,232,255,0.55)' : undefined,
              transform: 'translate(-50%, -50%)',
              opacity: br,
            }}
          />
        );
      })}

      {/* 原话落版 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 668,
          textAlign: 'center',
          opacity: tag,
          transform: `translateY(${lerp(14, 0, tag)}px)`,
          fontFamily: F.display,
          fontWeight: 600,
          fontSize: 44,
          letterSpacing: '-0.012em',
          color: C.white,
          textShadow: '0 0 40px rgba(61,64,254,0.6)',
        }}
      >
        DEEPSEEK,{' '}
        <span style={{ color: 'rgba(220,232,255,0.72)' }}>
          thinking <span style={{ color: C.blueHi }}>out loud.</span>
        </span>
      </div>

      {/* 域名行 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 736,
          textAlign: 'center',
          opacity: url * 0.55,
          ...MONO(12, 0.45, '0.5em'),
        }}
      >
        DEEPSEEK.COM
      </div>

      {/* 分隔与刻度 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 792,
          width: 760 * url,
          height: 1,
          marginLeft: -380 * url,
          background: 'linear-gradient(90deg, rgba(220,232,255,0), rgba(220,232,255,0.35), rgba(220,232,255,0))',
          opacity: url,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 812,
          textAlign: 'center',
          opacity: url * 0.4,
          ...MONO(10, 0.4, '0.44em'),
        }}
      >
        EVERY FRAME, EVERY SOUND — WRITTEN IN CODE
      </div>

      {/* 收尾微闪 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 470,
          width: 1100,
          height: 1100,
          marginLeft: -550,
          marginTop: -550,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,${0.35 * glint}) 0%, rgba(61,64,254,${0.25 * glint}) 30%, rgba(61,64,254,0) 62%)`,
          mixBlendMode: 'screen',
        }}
      />
    </Camera>
  );
};
