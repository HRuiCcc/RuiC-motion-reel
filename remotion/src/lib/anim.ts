/** 纯函数动效工具箱：全部只依赖帧号，渲染可任意断点续跑。 */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const eoExpo = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -11 * clamp(t)));
export const eiExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 11 * (clamp(t) - 1)));
export const eoQuint = (t: number) => 1 - Math.pow(1 - clamp(t), 5);
export const eoQuart = (t: number) => 1 - Math.pow(1 - clamp(t), 4);
export const eoCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const eiCubic = (t: number) => Math.pow(clamp(t), 3);
export const eioCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const eoBack = (t: number, s = 2.2) => {
  const x = clamp(t);
  return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
};

/** 确定哈希：同一帧永远同一个值 */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
export const hash2 = (a: number, b: number) => hash(a * 13.37 + b * 71.11);

export const noise1 = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
};

/** 手持/撞击感的相机抖动（低频 + 高频两层） */
export const shakeXY = (f: number, amp: number, seed = 0, freq = 1) => ({
  x: amp * (noise1(f * freq * 0.33 + seed * 13.1) * 2 - 1) + amp * 0.28 * (noise1(f * 2.7 + seed * 3.1) * 2 - 1),
  y: amp * (noise1(f * freq * 0.41 + seed * 7.7 + 50) * 2 - 1) + amp * 0.28 * (noise1(f * 3.1 + seed * 9.3 + 11) * 2 - 1),
});

/** 衰减抖动：一次撞击后迅速收住 */
export const hitShake = (f: number, start: number, amp: number, decay = 9, seed = 0) => {
  const d = f - start;
  if (d < 0) return { x: 0, y: 0 };
  return shakeXY(f, amp * Math.exp(-d / decay), seed);
};

export const blinkOn = (f: number, period: number, duty = 0.5) => f % period < period * duty;

/** 把 0..1 变成不透明的颜色 */
export const alpha = (a: number, rgb = '220,232,255') => `rgba(${rgb},${clamp(a)})`;

/** 数字千分位 */
export const comma = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
