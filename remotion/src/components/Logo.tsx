import React from 'react';
import { C, F } from '../theme';
import { GlowSparkle } from './Sparkle';

/**
 * 主标锁定：星芒 + DEEPSEEK。
 * 全片只有两个地方完整出现（撞击段与片尾），其余时候只露星芒。
 */
export const Logo: React.FC<{
  size: number;
  sparkle?: number;
  gap?: number;
  glow?: number;
  id?: string;
  rot?: number;
  tone?: 'light' | 'blue';
  /** 0..1：高光扫到字形的哪个位置（background-clip:text，光只落在笔画里） */
  sheen?: number;
  style?: React.CSSProperties;
}> = ({ size, sparkle, gap = 34, glow = 1, id = 'logoSp', rot = 0, tone = 'light', sheen, style }) => {
  const sp = sparkle ?? size * 0.82;
  const word = tone === 'blue' ? C.blueHi : C.white;
  const pos = (sheen ?? 0) * 100;
  const sheenStyle: React.CSSProperties =
    sheen === undefined
      ? {}
      : {
          backgroundImage: `linear-gradient(100deg, #FFFFFF 0%, #FFFFFF ${Math.max(0, pos - 15)}%, #C6DAFF ${pos}%, #FFFFFF ${Math.min(100, pos + 15)}%, #FFFFFF 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, ...style }}>
      <GlowSparkle size={sp} id={id} glow={glow} rot={rot} />
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 0.9,
          letterSpacing: '-0.035em',
          whiteSpace: 'nowrap',
          color: word,
          textShadow: `0 0 ${size * 0.28}px rgba(61,64,254,${0.55 * glow}), 0 0 ${size * 0.9}px rgba(61,64,254,${0.28 * glow})`,
          ...sheenStyle,
        }}
      >
        {sheen === undefined ? (
          <>
            DEEP<span style={{ color: C.ice, opacity: 0.97 }}>SEEK</span>
          </>
        ) : (
          'DEEPSEEK'
        )}
      </div>
    </div>
  );
};
