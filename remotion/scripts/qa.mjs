/**
 * QA：验证音频能量落点与画面 cue 是否对齐，并核对成片参数。
 *   node scripts/qa.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const wav = path.join(root, 'public', 'audio', 'score.wav');
const raw = fs.readFileSync(wav);
const SR = raw.readUInt32LE(24);
const data = raw.subarray(44);
const N = data.length / 4;
const mono = new Float32Array(N);
for (let i = 0; i < N; i++) {
  mono[i] = (data.readInt16LE(i * 4) + data.readInt16LE(i * 4 + 2)) / 65536;
}

const win = Math.round(SR * 0.02);
const frames = Math.floor(N / win);
const energy = [];
for (let f = 0; f < frames; f++) {
  let s = 0;
  for (let i = 0; i < win; i++) s += mono[f * win + i] ** 2;
  energy.push({ t: (f * win) / SR, db: 10 * Math.log10(s / win + 1e-12) });
}

// 近 0.4s 内的最大能量当成"一击"的时间
const peaks = [];
for (let i = 1; i < energy.length - 1; i++) {
  if (energy[i].db > energy[i - 1].db && energy[i].db >= energy[i + 1].db && energy[i].db > -16) {
    const last = peaks[peaks.length - 1];
    if (last && energy[i].t - last.t < 0.28) {
      if (energy[i].db > last.db) peaks[peaks.length - 1] = { ...energy[i] };
      continue;
    }
    peaks.push({ ...energy[i] });
  }
}

const top = [...peaks].sort((a, b) => b.db - a.db).slice(0, 10).sort((a, b) => a.t - b.t);
console.log(`时长 ${(N / SR).toFixed(3)}s · 采样 ${SR}Hz`);
console.log('最强 10 个撞击点：');
for (const p of top) console.log(`  ${p.t.toFixed(3)}s  ${p.db.toFixed(1)} dB  (帧 ${Math.round(p.t * 60)})`);

const expect = [14.0, 20.0, 0.5, 2.0, 4.0, 22.0];
console.log('关键 cue 处是否有能量：');
for (const e of expect) {
  const near = energy.find((x) => Math.abs(x.t - e) < 0.02);
  console.log(`  ${e.toFixed(2)}s -> ${near ? near.db.toFixed(1) + ' dB' : '缺失'}`);
}

const mp4 = path.join(root, 'out', 'ai-in-public-reel.mp4');
if (fs.existsSync(mp4)) {
  const size = (fs.statSync(mp4).size / 1024 / 1024).toFixed(1);
  console.log(`\n成片 ${mp4}  ${size} MB`);
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,duration', '-of', 'csv=p=0', mp4],
      { encoding: 'utf8' },
    );
    console.log(out.trim());
  } catch {
    console.log('ffprobe 不可用');
  }
} else {
  console.log('\n（尚未渲染成片）');
}
