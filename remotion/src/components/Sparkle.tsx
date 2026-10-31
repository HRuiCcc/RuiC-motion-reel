import React from 'react';
import { C } from '../theme';

/**
 * 品牌星芒：四角内凹星（sparkle）。
 * 整个片子的"标点"都靠它 —— 点燃、转场、高光、片尾都在用同一枚形状。
 */
export const Sparkle: React.FC<{
  size: number;
  rot?: number;
  id: string;
  fill?: string;
  style?: React.CSSProperties;
  opacity?: number;
}> = ({ size, rot = 0, id, fill, style, opacity = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="-100 -100 200 200"
    style={{ display: 'block', transform: `rotate(${rot}deg)`, opacity, ...style }}
  >
    <defs>
      <linearGradient id={id} x1="0" y1="-1" x2="0.15" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="42%" stopColor="#E6EEFF" />
        <stop offset="72%" stopColor={C.blueHi} />
        <stop offset="100%" stopColor={C.blue} />
      </linearGradient>
    </defs>
    <path
      d="M0,-100 C4.5,-19 19,-4.5 100,0 C19,4.5 4.5,19 0,100 C-4.5,19 -19,4.5 -100,0 C-19,-4.5 -4.5,-19 0,-100 Z"
      fill={fill ?? `url(#${id})`}
    />
  </svg>
);

/** 极小号星芒（角标 / 分隔用） */
export const MiniSparkle: React.FC<{ size: number; color?: string; opacity?: number }> = ({
  size,
  color = C.ice,
  opacity = 1,
}) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={{ display: 'block', opacity }}>
    <path d="M0,-10 C0.6,-1.8 1.8,-0.6 10,0 C1.8,0.6 0.6,1.8 0,10 C-0.6,1.8 -1.8,0.6 -10,0 C-1.8,-0.6 -0.6,-1.8 0,-10 Z" fill={color} />
  </svg>
);

/** 带光晕的星芒（片头点燃 / 片尾主标） */
export const GlowSparkle: React.FC<{
  size: number;
  rot?: number;
  id: string;
  glow?: number;
  opacity?: number;
}> = ({ size, rot = 0, id, glow = 1, opacity = 1 }) => (
  <div
    style={{
      position: 'relative',
      width: size,
      height: size,
      opacity,
      filter: `drop-shadow(0 0 ${size * 0.16 * glow}px rgba(61,64,254,${0.75 * glow})) drop-shadow(0 0 ${size * 0.42 * glow}px rgba(61,64,254,${0.36 * glow}))`,
    }}
  >
    <Sparkle size={size} rot={rot} id={id} />
  </div>
);
