import { Config } from '@remotion/cli/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Config.setOverwriteOutput(true);
// 一场一核就够；多给只会空转，还更容易把内存吃满。
Config.setConcurrency(6);
Config.setCodec('h264');
Config.setCrf(17);
Config.setX264Preset('slow');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setDelayRenderTimeoutInMilliseconds(180000);

/**
 * 浏览器：优先用本机已有的 chrome-headless-shell（省一次 ~150MB 下载）。
 * 依次找 REMOTION_BROWSER 环境变量 -> 仓库根的 _bin/ -> 交给 Remotion 自己下载。
 */
const PLATFORM = os.platform() === 'win32' ? 'win64' : os.arch() === 'arm64' ? 'mac-arm64' : 'mac-x64';
const EXE = os.platform() === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
const candidates = [
  process.env.REMOTION_BROWSER,
  path.resolve(process.cwd(), '..', '_bin', `chrome-headless-shell-${PLATFORM}`, EXE),
  path.resolve(process.cwd(), '..', '..', '_bin', `chrome-headless-shell-${PLATFORM}`, EXE),
];
const browser = candidates.find((p) => p && fs.existsSync(p));
if (browser) Config.setBrowserExecutable(browser);
