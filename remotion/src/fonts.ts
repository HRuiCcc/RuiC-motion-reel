import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import { F } from './theme';

/**
 * 自托管字体：Sora 做展示字，GeistMono 做仪表/终端。
 * 不用系统字体 —— 换机器字宽一变，整片排版会散。
 */
let started: Promise<unknown> | null = null;

export const ensureFonts = () => {
  if (started) return started;
  started = Promise.all([
    loadFont({ family: F.display, url: staticFile('fonts/sora-400.woff2'), weight: '400' }),
    loadFont({ family: F.display, url: staticFile('fonts/sora-600.woff2'), weight: '600' }),
    loadFont({ family: F.display, url: staticFile('fonts/sora-700.woff2'), weight: '700' }),
    loadFont({ family: F.display, url: staticFile('fonts/sora-800.woff2'), weight: '800' }),
    loadFont({ family: F.mono, url: staticFile('fonts/GeistMono-Regular.woff2'), weight: '400' }),
    loadFont({ family: F.mono, url: staticFile('fonts/GeistMono-Medium.woff2'), weight: '500' }),
    loadFont({ family: F.mono, url: staticFile('fonts/GeistMono-SemiBold.woff2'), weight: '600' }),
  ]);
  return started;
};
