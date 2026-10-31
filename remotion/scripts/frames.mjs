/**
 * 打印本片的帧数与秒数（给 shell 脚本用，避免在 bash 里算 BPM）。
 *   node scripts/frames.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const cues = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cues.json'), 'utf8'));
const bar = Math.round((60 / cues.bpm) * 4 * cues.fps);
console.log(bar * cues.bars);
