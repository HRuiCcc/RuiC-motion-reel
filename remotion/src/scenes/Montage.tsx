import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { GlowSparkle } from '../components/Sparkle';
import { comma, eoExpo, eoQuint, hash, lerp, norm } from '../lib/anim';

/**
 * 08 · MONTAGE（16–18s）
 * 一拍一个镜头，四刀：主张 / 代码 / 数字 / 星芒。
 * 每刀都在拍点上硬切，闪白 3 帧当作"胶片接缝"。
 */
const CODE_LINES = [
  { t: '$ deepseek run --think', c: C.white },
  { t: '› trace · 1,024 steps · open', c: 'rgba(220,232,255,0.7)' },
  { t: '✓ answer · weights · paper', c: C.blueHi },
];

const Panel: React.FC<{ q: number; children: React.ReactNode; label: string; idx: number }> = ({ q, children, label, idx }) => {
  const p = eoExpo(norm(q, 0, 6));
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: p,
          transform: `translateY(${lerp(22, 0, p)}px) scale(${lerp(1.03, 1, p)})`,
          filter: `blur(${lerp(7, 0, p)}px)`,
        }}
      >
        {children}
      </div>
      <div style={{ position: 'absolute', left: 300, top: 236, opacity: 0.75, ...MONO(12, 0.55, '0.44em') }}>
        0{idx + 1} / 04 · {label}
      </div>
    </>
  );
};

export const Montage: React.FC<{ f: number }> = ({ f }) => {
  const p = Math.min(3, Math.floor(f / 30));
  const q = f % 30;
  const flash = 1 - norm(q, 0, 4);
  const roll = 1024 * eoQuint(norm(q, 3, 24));
  const typed = Math.floor(norm(q, 1, 12) * CODE_LINES[0].t.length);
  const typed2 = Math.floor(norm(q, 5, 15) * CODE_LINES[1].t.length);
  const typed3 = Math.floor(norm(q, 9, 19) * CODE_LINES[2].t.length);

  return (
    <Camera scale={1 + 0.012 * (1 - eoExpo(norm(q, 0, 6)))}>
      {p === 0 ? (
        <Panel q={q} label="OPEN" idx={0}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 168, lineHeight: 0.92, letterSpacing: '-0.045em', color: C.white }}>
              BUILT
            </div>
            <div
              style={{
                fontFamily: F.display,
                fontWeight: 700,
                fontSize: 148,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: 'transparent',
                WebkitTextStroke: '2px rgba(220,232,255,0.85)',
                marginTop: 6,
              }}
            >
              IN THE OPEN
            </div>
            <div style={{ width: 560 * eoExpo(norm(q, 8, 20)), height: 3, background: C.blue, margin: '26px auto 0', boxShadow: '0 0 26px rgba(61,64,254,0.95)' }} />
          </div>
        </Panel>
      ) : null}

      {p === 1 ? (
        <Panel q={q} label="CODE" idx={1}>
          <div
            style={{
              width: 900,
              border: '1px solid rgba(220,232,255,0.18)',
              background: 'rgba(4,6,26,0.85)',
              padding: '34px 38px',
              boxShadow: '0 40px 120px -50px rgba(0,0,0,0.9)',
            }}
          >
            {CODE_LINES.map((l, i) => {
              const n = i === 0 ? typed : i === 1 ? typed2 : typed3;
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: F.mono,
                    fontSize: 27,
                    lineHeight: '58px',
                    height: 58,
                    color: l.c,
                    whiteSpace: 'pre',
                    textShadow: i === 0 ? '0 0 28px rgba(61,64,254,0.6)' : undefined,
                    opacity: n > 0 ? 1 : 0.15,
                  }}
                >
                  {l.t.slice(0, n)}
                </div>
              );
            })}
            <div style={{ height: 1, background: 'rgba(220,232,255,0.12)', margin: '18px 0 14px' }} />
            <div style={{ ...MONO(11, 0.3, '0.34em') }}>OPEN WEIGHTS · OPEN PAPER</div>
          </div>
        </Panel>
      ) : null}

      {p === 2 ? (
        <Panel q={q} label="TRACE" idx={2}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: F.mono,
                fontWeight: 500,
                fontSize: 232,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: C.white,
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 80px rgba(61,64,254,0.9)',
              }}
            >
              {comma(roll)}
            </div>
            <div style={{ ...MONO(13, 0.5, '0.46em'), marginTop: 20 }}>REASONING STEPS · TRACE</div>
          </div>
        </Panel>
      ) : null}

      {p === 3 ? (
        <Panel q={q} label="THINK" idx={3}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 620, height: 300, display: 'grid', placeItems: 'center' }}>
              {[0, 1, 2].map((i) => {
                const rp = norm(q, 3 + i * 5, 24 + i * 5);
                const size = 240 + rp * 560;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: size,
                      height: size,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                      borderRadius: '50%',
                      border: '1px solid rgba(110,113,255,0.4)',
                      opacity: (1 - rp) * 0.65,
                    }}
                  />
                );
              })}
              <GlowSparkle size={188} id="montSp" rot={q * 7} glow={1.6} />
            </div>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 132, letterSpacing: '-0.045em', color: C.white, textShadow: '0 0 60px rgba(61,64,254,0.8)', marginTop: -70 }}>
              THINK DEEPER<span style={{ color: C.blueHi }}>.</span>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* 切入闪白 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${flash * 0.55}) 0%, rgba(61,64,254,${flash * 0.3}) 40%, rgba(61,64,254,0) 70%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    </Camera>
  );
};
