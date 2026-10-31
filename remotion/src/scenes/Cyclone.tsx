import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { clamp, eiCubic, hash, lerp, norm } from '../lib/anim';

/**
 * 05 · STACK（10–12s）
 * 词柱上滚，中带反白：像在翻一叠牌子。速度在最后半秒猛地飙上去，接故障段。
 */
const ROWS = ['REASONING', 'CODING', 'MATH', 'AGENTS', 'CONTEXT', 'TOOLS', 'WEIGHTS', 'MEMORY'];
const rowH = 178;

export const Cyclone: React.FC<{ f: number }> = ({ f }) => {
  const x = norm(f, 96, 120);
  const off = 8.5 * f + 25.5 * 120 * (Math.pow(x, 4) / 4);
  const speed = lerp(8.5, 34, eiCubic(x));
  const blur = Math.min(14, speed * 0.34);
  const swap = norm(f, 112, 120);

  return (
    <Camera scale={1 + 0.05 * swap} blur={5 * swap}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'rotate(-4deg) scale(1.12)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 2%, #000 24%, #000 76%, transparent 98%)',
          maskImage: 'linear-gradient(180deg, transparent 2%, #000 24%, #000 76%, transparent 98%)',
        }}
      >
        {/* 中带反白底（先画，压在字下面；跟着当前行一起滚） */}
        {(() => {
          const active = clamp(Math.round(3.5 + off / rowH), 0, ROWS.length - 1);
          const ay = 540 + (active - 3.5) * rowH - off;
          return (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: ay - rowH / 2,
                  height: rowH,
                  background:
                    'linear-gradient(90deg, rgba(61,64,254,0) 0%, rgba(61,64,254,0.10) 22%, rgba(61,64,254,0.10) 78%, rgba(61,64,254,0) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: ay - rowH / 2,
                  height: rowH,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))',
                  mixBlendMode: 'screen',
                }}
              />
            </>
          );
        })()}

        {ROWS.map((w, i) => {
          const yc = 540 + (i - (ROWS.length - 1) / 2) * rowH - off;
          const focus = 1 - clamp(Math.abs(yc - 540) / 250);
          const a = 0.1 + 0.9 * focus;
          if (yc < -200 || yc > 1280) return null;
          return (
            <React.Fragment key={w}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: yc - rowH / 2,
                  height: rowH,
                  display: 'grid',
                  placeItems: 'center',
                  filter: `blur(${blur * (1 - focus * 0.85)}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: F.display,
                    fontWeight: 700,
                    fontSize: 142,
                    letterSpacing: '-0.045em',
                    lineHeight: 1,
                    color: focus > 0.55 ? `rgba(255,255,255,${a})` : `rgba(220,232,255,${a * 0.62})`,
                    transform: `scale(${0.9 + 0.1 * focus})`,
                    textShadow: focus > 0.5 ? '0 0 60px rgba(61,64,254,0.75)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 232,
                  top: yc - 12,
                  opacity: (0.18 + 0.72 * focus) * 0.9,
                  ...MONO(12, 1, '0.3em'),
                  color: focus > 0.55 ? C.blueHi : 'rgba(220,232,255,0.5)',
                }}
              >
                0{i + 1}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 左侧标题 */}
      <div style={{ position: 'absolute', left: 232, top: 150 }}>
        <div style={{ ...MONO(13, 0.62, '0.42em') }}>CAPABILITIES</div>
        <div style={{ ...MONO(11, 0.3, '0.34em'), marginTop: 10 }}>08 SURFACES · ONE MODEL</div>
      </div>

      {/* 右侧滚动指示 */}
      <div
        style={{
          position: 'absolute',
          right: 232,
          top: 150,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: 0.55,
        }}
      >
        <div style={{ ...MONO(11, 0.45, '0.34em') }}>SCROLL</div>
        <div style={{ width: 1, height: 40, background: 'linear-gradient(180deg, rgba(220,232,255,0.7), rgba(220,232,255,0))' }} />
      </div>

      {/* 右侧当前行读数（不跟着旋转，避免和左侧索引错位） */}
      <div style={{ position: 'absolute', right: 232, top: 420, textAlign: 'right' }}>
        <div style={{ ...MONO(11, 0.34, '0.34em') }}>NOW</div>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 40,
            letterSpacing: '-0.02em',
            color: C.white,
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 30px rgba(61,64,254,0.8)',
          }}
        >
          {String(clamp(Math.round(3.5 + off / rowH), 0, ROWS.length - 1) + 1).padStart(2, '0')}
          <span style={{ fontSize: 18, color: 'rgba(220,232,255,0.4)' }}> / 08</span>
        </div>
      </div>

      {/* 底部速度读数 */}
      <div style={{ position: 'absolute', left: 232, bottom: 190, ...MONO(11, 0.34, '0.36em') }}>
        {`Δ ${speed.toFixed(1)} PX/F · BLUR ${blur.toFixed(1)}`}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 232,
          bottom: 186,
          width: 220,
          height: 2,
          background: 'rgba(220,232,255,0.14)',
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: 220 * clamp(speed / 34), background: C.blueHi, boxShadow: '0 0 14px rgba(61,64,254,0.9)' }} />
      </div>
    </Camera>
  );
};
