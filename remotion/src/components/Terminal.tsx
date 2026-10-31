import React from 'react';
import { C, F } from '../theme';
import { blinkOn } from '../lib/anim';

/**
 * 终端面板：玻璃质感的深色窗，标题栏 + 逐字打出的命令行。
 * 打字节奏由外部按帧给（reveal 数组），所以音画能锁在同一格。
 */
export const Terminal: React.FC<{
  lines: string[];
  reveal: number[];
  width?: number;
  fontSize?: number;
  lineH?: number;
  title?: string;
  f: number;
  showCursor?: boolean;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ lines, reveal, width = 900, fontSize = 25, lineH = 52, title = 'deepseek — zsh — 96×28', f, showCursor = true, opacity = 1, style }) => {
  const lastIdx = Math.max(0, reveal.findIndex((n, i) => n < lines[i].length));
  const anyOpen = reveal.some((n, i) => n < lines[i].length);
  return (
    <div
      style={{
        width,
        borderRadius: 10,
        background: 'linear-gradient(180deg, rgba(8,12,44,0.94) 0%, rgba(4,6,26,0.96) 100%)',
        border: '1px solid rgba(220,232,255,0.18)',
        boxShadow: '0 40px 120px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(61,64,254,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        opacity,
        ...style,
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          height: 46,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 18px',
          borderBottom: '1px solid rgba(220,232,255,0.10)',
          background: 'rgba(255,255,255,0.022)',
        }}
      >
        <div style={{ width: 9, height: 9, borderRadius: 9, background: C.blue, boxShadow: '0 0 10px rgba(61,64,254,0.9)' }} />
        <div style={{ width: 9, height: 9, borderRadius: 9, background: 'rgba(220,232,255,0.30)' }} />
        <div style={{ width: 9, height: 9, borderRadius: 9, background: 'rgba(220,232,255,0.14)' }} />
        <div style={{ marginLeft: 12, fontFamily: F.mono, fontSize: 14, letterSpacing: '0.10em', color: 'rgba(220,232,255,0.42)' }}>{title}</div>
        <div style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 12, letterSpacing: '0.16em', color: 'rgba(220,232,255,0.30)' }}>LIVE</div>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 6,
            background: C.blueHi,
            marginLeft: 8,
            boxShadow: '0 0 12px rgba(110,113,255,0.95)',
            opacity: blinkOn(f, 30) ? 1 : 0.25,
          }}
        />
      </div>

      {/* 正文 */}
      <div style={{ padding: '26px 30px 30px' }}>
        {lines.map((ln, i) => {
          const n = Math.min(ln.length, Math.max(0, reveal[i] ?? 0));
          const text = ln.slice(0, n);
          const isCmd = ln.startsWith('$');
          const cursorHere = showCursor && i === lastIdx && anyOpen && blinkOn(f, 24);
          return (
            <div
              key={i}
              style={{
                fontFamily: F.mono,
                fontSize,
                lineHeight: `${lineH}px`,
                height: lineH,
                color: isCmd ? C.white : 'rgba(220,232,255,0.74)',
                letterSpacing: '0.01em',
                whiteSpace: 'pre',
                textShadow: isCmd ? '0 0 24px rgba(61,64,254,0.55)' : undefined,
              }}
            >
              {text}
              {cursorHere ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: fontSize * 0.52,
                    height: fontSize * 0.92,
                    background: C.blueHi,
                    marginLeft: 4,
                    verticalAlign: '-0.12em',
                    boxShadow: '0 0 16px rgba(61,64,254,0.95)',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 底部状态条 */}
      <div
        style={{
          height: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 18px',
          borderTop: '1px solid rgba(220,232,255,0.08)',
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: '0.20em',
          color: 'rgba(220,232,255,0.34)',
        }}
      >
        <span style={{ color: C.blueHi }}>● OPEN WEIGHTS</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span style={{ marginLeft: 'auto' }}>DEEPSEEK v1.0</span>
      </div>
    </div>
  );
};
