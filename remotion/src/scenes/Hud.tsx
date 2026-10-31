import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { comma, eoBack, eoExpo, hash, lerp, norm } from '../lib/anim';

/**
 * 04 · TELEMETRY（8–10s）
 * 环形仪表 + 读数 + 频谱条 + 准星锁定。这一场是"精密感"的担当。
 */
export const Hud: React.FC<{ f: number }> = ({ f }) => {
  const k = eoExpo(norm(f, 12, 86));
  const humans = 7900 + (8412 - 7900) * k;
  const tokens = 84120 * k;
  const lat = 15 - 3 * k;
  const lock = eoBack(norm(f, 52, 68), 1.9);
  const swap = norm(f, 110, 120);
  const ringR = [188, 258, 344];

  const rows = [
    ['MODE', 'REASONING'],
    ['TOKENS', comma(tokens).padStart(6, '0')],
    ['LATENCY', `${lat.toFixed(0).padStart(2, '0')} MS`],
    ['PRECISION', 'FP8'],
    ['STATUS', 'OPEN'],
  ];

  return (
    <Camera scale={1 + 0.045 * swap} blur={6 * swap} y={-10 * swap}>
      {/* 环形仪表 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <g transform="translate(960 540)">
          {ringR.map((r, ri) => (
            <circle
              key={r}
              r={r}
              fill="none"
              stroke={`rgba(220,232,255,${0.1 + ri * 0.03})`}
              strokeWidth={1}
              strokeDasharray={ri === 1 ? '2 10' : undefined}
              style={{ transform: `rotate(${f * (ri % 2 === 0 ? 0.35 : -0.55)}deg)`, transformOrigin: 'center' }}
            />
          ))}
          {/* 刻度 */}
          <g style={{ transform: `rotate(${f * 0.18}deg)`, transformOrigin: 'center' }}>
            {Array.from({ length: 90 }).map((_, i) => {
              const a = (i / 90) * Math.PI * 2;
              const big = i % 10 === 0;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 344}
                  y1={Math.sin(a) * 344}
                  x2={Math.cos(a) * (344 - (big ? 22 : 9))}
                  y2={Math.sin(a) * (344 - (big ? 22 : 9))}
                  stroke={`rgba(220,232,255,${big ? 0.5 : 0.22})`}
                  strokeWidth={big ? 1.4 : 0.8}
                />
              );
            })}
          </g>
          {/* 进度弧 */}
          <circle
            r={258}
            fill="none"
            stroke={C.blueHi}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 258 * 0.34} ${2 * Math.PI * 258}`}
            opacity={0.85}
            style={{ transform: `rotate(${-90 + f * 1.1}deg)`, transformOrigin: 'center' }}
          />
        </g>
      </svg>

      {/* 雷达扫掠 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 540,
          width: 760,
          height: 760,
          marginLeft: -380,
          marginTop: -380,
          borderRadius: '50%',
          background: `conic-gradient(from ${f * 3.2}deg, rgba(61,64,254,0) 0deg, rgba(61,64,254,0.18) 30deg, rgba(61,64,254,0) 62deg, rgba(61,64,254,0) 360deg)`,
          WebkitMaskImage: 'radial-gradient(circle, transparent 54%, #000 56%)',
          maskImage: 'radial-gradient(circle, transparent 54%, #000 56%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 中央计数 */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', transform: 'translateY(6px)' }}>
          <div
            style={{
              fontFamily: F.mono,
              fontWeight: 500,
              fontSize: 92,
              letterSpacing: '-0.02em',
              color: C.white,
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 46px rgba(61,64,254,0.85)',
            }}
          >
            {comma(humans)}
          </div>
          <div style={{ ...MONO(12, 0.5, '0.46em'), marginTop: 14 }}>REASONING TOKENS</div>
        </div>
      </div>

      {/* 准星 */}
      {[
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
      ].map((d, i) => {
        const off = lerp(168, 92, lock);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 960 + d.x * off,
              top: 540 + d.y * off,
              width: 26,
              height: 26,
              borderTop: d.y < 0 ? '1px solid rgba(220,232,255,0.75)' : undefined,
              borderBottom: d.y > 0 ? '1px solid rgba(220,232,255,0.75)' : undefined,
              borderLeft: d.x < 0 ? '1px solid rgba(220,232,255,0.75)' : undefined,
              borderRight: d.x > 0 ? '1px solid rgba(220,232,255,0.75)' : undefined,
              transform: `translate(-50%, -50%)`,
              opacity: 0.2 + 0.8 * lock,
              boxShadow: lock > 0.8 ? '0 0 22px rgba(61,64,254,0.9)' : undefined,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 540 - 152,
          transform: 'translateX(-50%)',
          ...MONO(11, 0.9, '0.5em'),
          color: C.blueHi,
          opacity: lock > 0.7 ? 1 : 0,
          fontFamily: F.mono,
        }}
      >
        LOCK
      </div>

      {/* 左侧读数 */}
      <div style={{ position: 'absolute', left: 300, top: 330, width: 380 }}>
        {rows.map(([a, b], i) => {
          const ap = norm(f, 8 + i * 5, 20 + i * 5);
          return (
            <div
              key={a}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '11px 0',
                borderBottom: '1px solid rgba(220,232,255,0.10)',
                opacity: ap,
                transform: `translateX(${lerp(-18, 0, ap)}px)`,
              }}
            >
              <span style={MONO(12, 0.42, '0.30em')}>{a}</span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 17,
                  letterSpacing: '0.04em',
                  color: i === 4 ? C.blueHi : 'rgba(220,232,255,0.92)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {b}
              </span>
            </div>
          );
        })}
      </div>

      {/* 右侧频谱 */}
      <div
        style={{
          position: 'absolute',
          right: 280,
          top: 396,
          width: 400,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          opacity: norm(f, 16, 34),
        }}
      >
        {Array.from({ length: 42 }).map((_, i) => {
          const env = 0.35 + 0.65 * Math.abs(Math.sin(f * 0.13 + i * 0.42));
          const h = 12 + 150 * env * (0.35 + hash(i * 3.3) * 0.85) * norm(f, 16 + i, 30 + i);
          return (
            <div
              key={i}
              style={{
                width: 6,
                height: h,
                background: `linear-gradient(180deg, ${C.ice}, rgba(61,64,254,0.75))`,
                boxShadow: '0 0 12px rgba(61,64,254,0.55)',
                opacity: 0.55 + 0.45 * env,
              }}
            />
          );
        })}
      </div>
      <div style={{ position: 'absolute', right: 280, top: 620, textAlign: 'right', ...MONO(11, 0.34, '0.36em') }}>
        REASONING / VISIBLE / LIVE
      </div>

      {/* 底部滚动条 */}
      <div
        style={{
          position: 'absolute',
          left: 280,
          right: 280,
          bottom: 190,
          height: 18,
          overflow: 'hidden',
          opacity: 0.5 * norm(f, 20, 40),
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        }}
      >
        <div
          style={{
            whiteSpace: 'nowrap',
            ...MONO(11, 0.42, '0.44em'),
            transform: `translateX(${-((f * 2.6) % 720)}px)`,
          }}
        >
          {Array.from({ length: 6 })
            .map(() => 'PROMPT → THINK → ANSWER → ')
            .join('')}
        </div>
      </div>
    </Camera>
  );
};
