import React from 'react';
import { C } from '../theme';
import { lerp } from '../lib/anim';

/**
 * 拖影模糊：代码里的"运动模糊"。
 * Remotion 一次只渲一帧，真运动模糊要多次采样；这里用沿速度方向的低透明度残影
 * 叠出定向拖尾 —— 快切和砸字时读起来就是实拍那味儿。
 */
export const Trail: React.FC<{
  dx: number;
  dy: number;
  n?: number;
  blur?: number;
  opacity?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ dx, dy, n = 4, blur = 7, opacity = 0.5, style, children }) => (
  <div style={{ position: 'relative', ...style }}>
    {Array.from({ length: n }).map((_, i) => {
      const k = (i + 1) / n;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            transform: `translate(${dx * k}px, ${dy * k}px)`,
            // 注意：opacity 和 filter 同时用会让这层出现矩形黑边（软件光栅化下
            // 非预乘纹理漏出来），所以透明度必须写进 filter 链里。
            filter: `blur(${Math.max(0.01, blur * k)}px) opacity(${opacity * (1 - k) * 0.8})`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        >
          {children}
        </div>
      );
    })}
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>{children}</div>
  </div>
);

/** 速度线：横向细线随帧流过，给"高速"兜底 */
export const SpeedLines: React.FC<{ f: number; count?: number; opacity?: number; color?: string }> = ({
  f,
  count = 14,
  opacity = 0.16,
  color = C.ice,
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => {
      const y = 40 + ((i * 137.7) % 1000);
      const len = 120 + ((i * 53) % 340);
      const x = 1900 - ((f * (9 + (i % 5) * 4) + i * 260) % 2400);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: len,
            height: i % 4 === 0 ? 2 : 1,
            background: `linear-gradient(90deg, ${color}00, ${color}, ${color}00)`,
            opacity: opacity * (0.35 + ((i * 31) % 10) / 14),
          }}
        />
      );
    })}
  </>
);

/** 相机：位移/缩放/旋转/模糊，一处封装 */
export const Camera: React.FC<{
  x?: number;
  y?: number;
  scale?: number;
  rot?: number;
  blur?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x = 0, y = 0, scale = 1, rot = 0, blur = 0, style, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rot}deg)`,
      transformOrigin: '50% 50%',
      filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      willChange: 'transform',
      ...style,
    }}
  >
    {children}
  </div>
);

/** 文字高光的色差（RGB split），蓝/冰两族内做，不引入红绿 */
export const chroma = (px: number, a = 0.55) =>
  px <= 0
    ? undefined
    : `${px}px 0 0 rgba(61,64,254,${a}), ${-px}px 0 0 rgba(220,232,255,${a * 0.8})`;

/**
 * 高光扫过：必须"软"。硬边矩形在深底上会变成一块白板 —— 加模糊 + screen 之后
 * 才像一道掠光。
 */
export const LightSweep: React.FC<{
  p: number;
  y: number;
  x?: number;
  w?: number;
  h?: number;
  opacity?: number;
  from?: number;
  to?: number;
}> = ({ p, y, x = 960, w = 260, h = 440, opacity = 0.5, from = -780, to = 780 }) => {
  if (p <= 0 || p >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        transform: `translateX(${lerp(from, to, p)}px) skewX(-16deg)`,
        background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 48%, rgba(255,255,255,0) 100%)',
        filter: 'blur(26px)',
        mixBlendMode: 'screen',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
