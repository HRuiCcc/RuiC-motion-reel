/**
 * AI In Public — 品牌与几何骨架。
 *
 * 调色只四族，全片不越界：
 *   blue #3D40FE（主色）/ navy（台面）/ ice（冷白阶）/ white（最高亮度）
 * 告警色一律不用；所有"热"都靠 blue 的辉光和 white 的高光表达。
 */
export const C = {
  blue: '#3D40FE',
  blueHi: '#6E71FF',
  blueDeep: '#1B1DA8',
  blueInk: '#0B0C63',

  navy0: '#01030C',
  navy1: '#03051A',
  navy2: '#070B2C',
  navy3: '#0C1240',

  ice: '#DCE8FF',
  iceMid: '#A9BEE4',
  iceDim: '#6E82AC',

  white: '#FFFFFF',

  dim: 'rgba(220,232,255,0.58)',
  faint: 'rgba(220,232,255,0.30)',
  ghost: 'rgba(220,232,255,0.12)',
  line: 'rgba(220,232,255,0.20)',
  lineSoft: 'rgba(220,232,255,0.09)',
} as const;

export const F = {
  display: 'Sora',
  mono: 'GeistMono',
} as const;

export const L = {
  w: 1920,
  h: 1080,
  fps: 60,
  cx: 960,
  cy: 540,
} as const;

export const GLOW = {
  blue: '0 0 70px rgba(61,64,254,0.55), 0 0 160px rgba(61,64,254,0.28)',
  blueSoft: '0 0 40px rgba(61,64,254,0.35)',
  ice: '0 0 60px rgba(220,232,255,0.35)',
  text: '0 0 28px rgba(61,64,254,0.55), 0 0 90px rgba(61,64,254,0.30)',
} as const;

/** 等宽小字的统一配方（HUD 全部走这套，字宽一致才像仪表） */
export const MONO = (size: number, opacity = 0.75, tracking = '0.22em') =>
  ({
    fontFamily: F.mono,
    fontSize: size,
    letterSpacing: tracking,
    textTransform: 'uppercase' as const,
    color: `rgba(220,232,255,${opacity})`,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap' as const,
  }) as const;

export const DISPLAY = (size: number, weight = 800) =>
  ({
    fontFamily: F.display,
    fontWeight: weight,
    fontSize: size,
    letterSpacing: '-0.035em',
    lineHeight: 0.92,
    color: C.white,
  }) as const;
