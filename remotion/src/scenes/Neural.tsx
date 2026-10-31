import React from 'react';
import { C, F, MONO } from '../theme';
import { Camera } from '../components/Fx';
import { clamp, hash, hitShake, lerp, norm } from '../lib/anim';

/**
 * 03 · NEURAL（6–8s）
 * 不是"随便撒点连线"：30 个节点按黄金角排布，真实 3D 旋转后投影，
 * 边与脉冲都从投影坐标算 —— 所以镜头绕的时候透视是对的。
 */
const N = 30;
const NODES = Array.from({ length: N }, (_, i) => {
  const ang = i * 2.399963229728653;
  const rad = Math.sqrt((i + 0.55) / N);
  const R = 500;
  return {
    x: Math.cos(ang) * rad * R * (0.86 + hash(i * 3.3) * 0.3),
    y: Math.sin(ang) * rad * R * (0.68 + hash(i * 5.1) * 0.42),
    z: (hash(i * 9.7) * 2 - 1) * 330,
    r: 1.6 + hash(i * 2.2) * 3.6,
  };
});
const EDGES: [number, number][] = [];
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    const a = NODES[i];
    const b = NODES[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);
    if (d < 330) EDGES.push([i, j]);
  }
}
const LABELS: { i: number; t: string; dir: number }[] = [
  { i: 4, t: 'experts', dir: 1 },
  { i: 11, t: 'router', dir: -1 },
  { i: 19, t: 'tokens', dir: 1 },
  { i: 25, t: 'context', dir: -1 },
];

export const Neural: React.FC<{ f: number }> = ({ f }) => {
  const orbit = -0.5 + f * 0.0128;
  const cs = Math.cos(orbit);
  const sn = Math.sin(orbit);
  const project = (x: number, y: number, z: number) => {
    const px = x * cs - z * sn;
    const pz = x * sn + z * cs;
    const k = 1180 / (1180 + pz + 540);
    return { X: 960 + px * k * 1.05, Y: 540 + y * k, k };
  };
  const sh = hitShake(f, 68, 7, 7, 12);
  const punch = 1 + 0.035 * Math.exp(-Math.max(0, f - 68) / 9) * (f > 66 ? 1 : 0);
  const outP = norm(f, 110, 120);
  const fade = 1 - 0.7 * outP;

  const corePulse = 0.85 + 0.15 * Math.sin(f * 0.16);

  return (
    <Camera x={sh.x} y={sh.y} scale={punch * (1 + 0.1 * outP)} blur={10 * outP}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {/* 边 */}
        {EDGES.map(([a, b], e) => {
          const pa = project(NODES[a].x, NODES[a].y, NODES[a].z);
          const pb = project(NODES[b].x, NODES[b].y, NODES[b].z);
          const app = norm(f, 24 + e * 0.55, 34 + e * 0.55);
          const depth = (pa.k + pb.k) / 2;
          return (
            <line
              key={`e${e}`}
              x1={pa.X}
              y1={pa.Y}
              x2={lerp(pa.X, pb.X, app)}
              y2={lerp(pa.Y, pb.Y, app)}
              stroke={`rgba(61,64,254,${(0.34 + depth * 0.26) * fade})`}
              strokeWidth={depth > 0.72 ? 1.3 : 1}
            />
          );
        })}

        {/* 沿边跑的脉冲 */}
        {EDGES.map(([a, b], e) => {
          const pa = project(NODES[a].x, NODES[a].y, NODES[a].z);
          const pb = project(NODES[b].x, NODES[b].y, NODES[b].z);
          const t = (f * 0.009 + hash(e * 2.7)) % 1;
          const show = f > 40 + hash(e) * 20;
          if (!show) return null;
          return (
            <circle
              key={`p${e}`}
              cx={lerp(pa.X, pb.X, t)}
              cy={lerp(pa.Y, pb.Y, t)}
              r={1.5 + 1.4 * hash(e * 5.5)}
              fill={hash(e * 1.3) > 0.65 ? C.ice : C.blueHi}
              opacity={0.85 * Math.sin(t * Math.PI) * fade}
            />
          );
        })}

        {/* 节点 */}
        {NODES.map((n, i) => {
          const p = project(n.x, n.y, n.z);
          const app = norm(f, 3 + i * 1.05, 11 + i * 1.05);
          if (app <= 0) return null;
          const pop = 1 + 0.9 * (1 - app);
          const r = n.r * p.k * 1.5 * pop;
          return (
            <g key={`n${i}`} opacity={app * fade}>
              <circle cx={p.X} cy={p.Y} r={r * 3.4} fill="rgba(61,64,254,0.16)" />
              <circle cx={p.X} cy={p.Y} r={r} fill={p.k > 0.72 ? C.white : C.ice} opacity={0.55 + p.k * 0.45} />
              <circle cx={p.X} cy={p.Y} r={r + 5} fill="none" stroke="rgba(220,232,255,0.35)" strokeWidth={0.7} />
            </g>
          );
        })}

        {/* 标签引线 */}
        {LABELS.map((l, i) => {
          const n = NODES[l.i];
          const p = project(n.x, n.y, n.z);
          const app = norm(f, 44 + i * 6, 56 + i * 6) * fade;
          const len = 84;
          const ex = p.X + l.dir * len;
          return (
            <g key={`l${i}`} opacity={app}>
              <line x1={p.X} y1={p.Y} x2={ex} y2={p.Y - 34} stroke="rgba(220,232,255,0.4)" strokeWidth={0.8} />
              <line
                x1={ex}
                y1={p.Y - 34}
                x2={ex + l.dir * 54}
                y2={p.Y - 34}
                stroke="rgba(220,232,255,0.4)"
                strokeWidth={0.8}
              />
              <text
                x={l.dir > 0 ? ex + 8 : ex - 8}
                y={p.Y - 44}
                fill="rgba(220,232,255,0.62)"
                fontFamily={F.mono}
                fontSize={15}
                letterSpacing="2.2"
                textAnchor={l.dir > 0 ? 'start' : 'end'}
              >
                {l.t}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 核心 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 540,
          width: 240 * corePulse,
          height: 240 * corePulse,
          marginLeft: (-240 * corePulse) / 2,
          marginTop: (-240 * corePulse) / 2,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(220,232,255,0.42) 12%, rgba(61,64,254,0.42) 30%, rgba(61,64,254,0) 62%)',
          mixBlendMode: 'screen',
          opacity: 0.9 * norm(f, 0, 20) * fade,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 540,
          width: 72,
          height: 72,
          marginLeft: -36,
          marginTop: -36,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 0 40px rgba(61,64,254,1), inset 0 0 24px rgba(255,255,255,0.7)',
          opacity: norm(f, 4, 18) * fade,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 540,
          width: 168,
          height: 168,
          marginLeft: -84,
          marginTop: -84,
          borderRadius: '50%',
          border: '1px solid rgba(110,113,255,0.35)',
          opacity: norm(f, 8, 26) * fade,
        }}
      />

      {/* 外圈刻度 */}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 0.3 * norm(f, 20, 50) }}>
        <g transform="translate(960 540)" style={{ transform: `rotate(${f * 0.5}deg)` }}>
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={Math.cos(a) * 430}
                y1={Math.sin(a) * 430}
                x2={Math.cos(a) * (i % 4 === 0 ? 408 : 418)}
                y2={Math.sin(a) * (i % 4 === 0 ? 408 : 418)}
                stroke="rgba(220,232,255,0.5)"
                strokeWidth={1}
              />
            );
          })}
        </g>
      </svg>

      {/* 读数 */}
      <div style={{ position: 'absolute', left: 300, top: 168, opacity: norm(f, 24, 40), ...MONO(13, 0.62, '0.4em') }}>
        MIXTURE OF EXPERTS
      </div>
      <div style={{ position: 'absolute', left: 300, top: 196, opacity: norm(f, 30, 46), ...MONO(11, 0.3, '0.34em') }}>
        {`NODES ${N} · EDGES ${EDGES.length} · Δt 12MS`}
      </div>
      <div style={{ position: 'absolute', right: 300, bottom: 200, opacity: norm(f, 36, 54), textAlign: 'right', ...MONO(12, 0.42, '0.36em') }}>
        <div>REASONING TRACE</div>
        <div style={{ marginTop: 8, color: 'rgba(110,113,255,0.85)' }}>● LIVE INFERENCE</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 176,
          width: 240,
          height: 1,
          background: 'rgba(220,232,255,0.25)',
          opacity: norm(f, 30, 50),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 160,
          width: 240 * clamp(norm(f, 30, 116)),
          height: 2,
          background: C.blueHi,
          boxShadow: '0 0 16px rgba(61,64,254,0.9)',
          opacity: norm(f, 30, 50),
        }}
      />
    </Camera>
  );
};
