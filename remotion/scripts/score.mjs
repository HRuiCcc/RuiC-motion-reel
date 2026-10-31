/**
 * AI In Public — Motion Reel 001
 * 24 秒配乐 + 音效，全部用代码合成（无采样、无外部音源）。
 *
 * 网格：120 BPM × 12 小节 = 24.000s，与画面 cues.json 同一套帧号。
 * 每个乐器都只写"第几拍"，所有撞击点落在 0/2/4/…/22s 这些整小节线上。
 *
 *   node scripts/score.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const DUR = 24;
const N = Math.round(SR * DUR);
const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2.0s
const E8 = BEAT / 2; // 0.25s
const S16 = BEAT / 4; // 0.125s

const make = () => [new Float32Array(N), new Float32Array(N)];
const BUS = { drums: make(), music: make(), sfx: make(), verb: make() };

/* ---------- 基础工具 ---------- */

let seed = 987654321;
const rnd = () => {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return (seed / 4294967296) * 2 - 1;
};

const panGain = (p) => {
  const a = ((Math.min(1, Math.max(-1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};

function put(bus, i, v, pan = 0, verb = 0) {
  if (i < 0 || i >= N) return;
  const [gl, gr] = panGain(pan);
  bus[0][i] += v * gl;
  bus[1][i] += v * gr;
  if (verb > 0) {
    BUS.verb[0][i] += v * gl * verb;
    BUS.verb[1][i] += v * gr * verb;
  }
}

class BQ {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0;
  }
  set(type, f, q = 0.707) {
    f = Math.min(Math.max(f, 20), SR * 0.45);
    const w = (2 * Math.PI * f) / SR;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const al = sn / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- 鼓 ---------- */

const duck = new Float32Array(N).fill(1);
function sidechain(t0, depth = 0.5, rel = 0.24) {
  const i0 = Math.round(t0 * SR);
  const m = Math.floor(rel * SR);
  for (let i = 0; i < m; i++) {
    const g = 1 - depth * Math.exp(-i / (rel * SR * 0.5));
    const k = i0 + i;
    if (k >= 0 && k < N) duck[k] *= g;
  }
}

function kick(t0, gain = 1, o = {}) {
  const { f0 = 168, f1 = 45, dec = 7.5, len = 0.6, pan = 0 } = o;
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t * 26);
    ph += (2 * Math.PI * f) / SR;
    let v = Math.sin(ph) * Math.exp(-t * dec);
    v += rnd() * 0.16 * Math.exp(-t * 340);
    put(BUS.drums, i0 + i, Math.tanh(v * 1.25) * gain, pan, 0.05);
  }
}

function snare(t0, gain = 0.8, pan = 0.05) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(0.34 * SR);
  const bp = new BQ(); bp.set('bp', 1850, 0.75);
  const hp = new BQ(); hp.set('hp', 620, 0.8);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const nz = bp.p(rnd()) * 1.7 + hp.p(rnd()) * 0.5;
    ph += (2 * Math.PI * 188) / SR;
    const tone = Math.sin(ph) * Math.exp(-t * 34) * 0.55;
    const v = (nz * Math.exp(-t * 16) + tone) * 0.85;
    put(BUS.drums, i0 + i, v * gain, pan, 0.18);
  }
}

function hat(t0, gain = 0.4, open = false, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const len = open ? 0.22 : 0.05;
  const n = Math.floor(len * SR);
  const hp1 = new BQ(); hp1.set('hp', 5200, 0.8);
  const hp2 = new BQ(); hp2.set('hp', 8200, 0.9);
  const p = pan + (rnd() - 0.5) * 0.1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = hp2.p(hp1.p(rnd())) * Math.exp(-t * (open ? 15 : 108));
    put(BUS.drums, i0 + i, v * gain, p, 0.07);
  }
}

function crash(t0, gain = 0.7, len = 2.4) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  const hp = new BQ(); hp.set('hp', 3200, 0.65);
  const p = (rnd() - 0.5) * 0.3;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = hp.p(rnd()) * Math.exp(-t / 0.8) * (1 + 0.35 * Math.sin(t * 78));
    put(BUS.drums, i0 + i, v * gain * 0.5, p, 0.42);
  }
}

/* ---------- 音效 ---------- */

function slam(t0, gain = 0.8) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(0.55 * SR);
  const lp = new BQ(); lp.set('lp', 1100, 0.9);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 40 + 96 * Math.exp(-t * 32);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 8.5) + lp.p(rnd()) * Math.exp(-t * 120) * 0.85;
    put(BUS.sfx, i0 + i, Math.tanh(v * 1.2) * gain, 0, 0.3);
  }
  crash(t0, gain * 0.22, 0.9);
}

function impact(t0, gain = 1) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(2.6 * SR);
  const lp = new BQ(); lp.set('lp', 380, 0.9);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 32 + 128 * Math.exp(-t * 6.2);
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-t * 1.45) * 1.15 + lp.p(rnd()) * Math.exp(-t * 5.2) * 0.9;
    put(BUS.sfx, i0 + i, Math.tanh(v * 1.25) * gain, 0, 0.38);
  }
  // 前置反向吸气
  const m = Math.floor(0.28 * SR);
  for (let i = 0; i < m; i++) {
    const t = i / m;
    put(BUS.sfx, i0 - m + i, rnd() * 0.3 * Math.pow(t, 2.8), 0, 0.25);
  }
  crash(t0, gain * 0.85, 2.8);
}

function riser(t0, len, gain = 0.5) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  const bp = new BQ();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    if (i % 32 === 0) bp.set('bp', 300 * Math.pow(30, p), 1.1);
    const nz = bp.p(rnd()) * Math.pow(p, 2.1);
    ph += (2 * Math.PI * 180 * Math.pow(4.5, p)) / SR;
    const tone = Math.sin(ph) * Math.pow(p, 3) * 0.2;
    put(BUS.sfx, i0 + i, (nz * 0.95 + tone) * gain, Math.sin(p * 5.5) * 0.4, 0.28);
  }
}

function whoosh(t0, len = 0.42, gain = 0.45, panFrom = -0.65, panTo = 0.65) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  const bp = new BQ(); bp.set('bp', 1200, 1.3);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    if (i % 64 === 0) bp.set('bp', 260 + 3200 * Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.15)), 2), 1.2);
    const env = Math.pow(Math.sin(Math.PI * p), 1.5);
    put(BUS.sfx, i0 + i, bp.p(rnd()) * env * gain, panFrom + (panTo - panFrom) * p, 0.22);
  }
}

function glitch(t0, len, gain = 0.35, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  let hold = 0;
  for (let i = 0; i < n; i++) {
    if (i % 200 === 0) hold = rnd();
    const t = i / SR;
    const gate = Math.floor(i / 170) % 3 === 0 ? 1 : 0.12;
    const v = (Math.sin(2 * Math.PI * (300 + hold * 2600) * t) * 0.5 + rnd() * 0.55) * gate;
    put(BUS.sfx, i0 + i, v * gain * Math.exp(-t * 1.6), pan, 0.1);
  }
}

function tick(t0, gain = 0.12, pan = 0, bright = 2400) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(0.04 * SR);
  const hp = new BQ(); hp.set('hp', bright, 1.2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    put(BUS.sfx, i0 + i, hp.p(rnd()) * Math.exp(-t * 130) * gain, pan, 0.06);
  }
}

/* ---------- 音乐 ---------- */

function pluck(t0, m, gain = 0.16, pan = 0, len = 0.5) {
  const f = hz(m);
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  const lp = new BQ(); lp.set('lp', 3000, 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 1; k <= 8; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
    const env = Math.exp(-t * 10) * (1 - Math.exp(-t * 1200));
    put(BUS.music, i0 + i, lp.p(v * 0.2) * env * gain, pan, 0.32);
  }
}

function bass(t0, m, dur, gain = 0.5) {
  const f = hz(m);
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(dur * SR);
  const lp = new BQ();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 32 === 0) lp.set('lp', 150 + 620 * Math.exp(-t * 8), 1.15);
    let v = 0;
    for (let k = 1; k <= 7; k++) v += Math.sin(2 * Math.PI * f * k * t) / k;
    v = v * 0.3 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.34;
    const env = Math.min(1, t * 160) * Math.exp(-t * (2.6 / dur)) * Math.min(1, Math.max(0, (dur - t) * 45));
    put(BUS.music, i0 + i, lp.p(v) * env * gain, 0, 0.14);
  }
}

function pad(t0, dur, notes, gain = 0.22, cutoff = 900) {
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(dur * SR);
  const lpL = new BQ(); lpL.set('lp', cutoff, 0.75);
  const lpR = new BQ(); lpR.set('lp', cutoff * 1.04, 0.75);
  const det = [-7, 0, 7];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let sl = 0;
    let sr = 0;
    for (const m of notes) {
      const f = hz(m);
      for (let d = 0; d < 3; d++) {
        const fq = f * Math.pow(2, det[d] / 1200);
        const vib = 1 + 0.0016 * Math.sin(2 * Math.PI * 0.21 * t + d);
        let v = 0;
        for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * fq * k * vib * t + d * 1.7) / (k * k * 0.5);
        v *= 0.15;
        if (d < 2) sl += v;
        else sr += v;
      }
    }
    const env = Math.min(1, t / 0.7) * Math.min(1, Math.max(0, (dur - t) / 0.45));
    const lfo = 0.78 + 0.22 * Math.sin(2 * Math.PI * 0.07 * t);
    put(BUS.music, i0 + i, lpL.p(sl) * env * gain * lfo, -0.38, 0.5);
    put(BUS.music, i0 + i, lpR.p(sr) * env * gain * lfo, 0.38, 0.5);
  }
}

function bell(t0, m, gain = 0.24, pan = 0, len = 2.6) {
  const f = hz(m);
  const i0 = Math.round(t0 * SR);
  const n = Math.floor(len * SR);
  const ratios = [1, 2.01, 2.99, 4.07, 5.41];
  const amps = [1, 0.42, 0.26, 0.13, 0.07];
  const decs = [1.1, 1.9, 2.7, 3.8, 5.2];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < ratios.length; k++) v += Math.sin(2 * Math.PI * f * ratios[k] * t) * amps[k] * Math.exp(-t * decs[k]);
    put(BUS.music, i0 + i, v * gain * 0.32, pan, 0.55);
  }
}

/* ---------- 编曲 ---------- */

const Am = [45, 48, 52, 57];
const F = [41, 45, 48, 53];
const Cc = [48, 52, 55, 60];
const G = [43, 47, 50, 55];
const Aa = [45, 49, 52, 57];

// 0–2s 引子
pad(0.0, 2.3, Am, 0.3, 620);
bass(0.0, 33, 2.0, 0.26);
tick(0.5, 0.1, -0.3, 1800);
tick(1.0, 0.09, 0.3, 1800);
tick(1.5, 0.1, -0.3, 1800);
bell(0.5, 93, 0.2, -0.15, 2.8);
bell(0.5, 100, 0.1, 0.25, 2.2);
glitch(1.16, 0.14, 0.14, -0.2);

// 2–4s 终端
whoosh(1.86, 0.5, 0.34, -0.7, 0.7);
kick(2.0, 0.75, { f0: 180, dec: 9 });
sidechain(2.0, 0.4);
pad(2.0, 2.05, Am, 0.24, 760);
bass(2.0, 33, 1.0, 0.2);
for (let t = 2.1; t < 3.62; t += 1 / 19) tick(t, 0.055 + (rnd() * 0.02), (rnd() - 0.5) * 0.8, 2600);
riser(3.28, 0.72, 0.26);
glitch(3.8, 0.13, 0.16, 0.3);

// 4–6s 砸字
for (let k = 0; k < 4; k++) {
  const t = 4.0 + k * BEAT;
  slam(t, 0.82);
  sidechain(t, 0.46);
}
pad(4.0, 2.0, Am, 0.2, 880);
for (let s = 0; s < 16; s++) hat(4.0 + s * S16, s % 4 === 0 ? 0.22 : 0.12, false, s % 2 ? 0.22 : -0.22);
for (let k = 0; k < 8; k++) bass(4.0 + k * E8, 33, 0.22, 0.3);

// 6–8s 神经
whoosh(5.9, 0.4, 0.3, 0.6, -0.6);
slapCymbal: {
  crash(6.0, 0.32, 1.8);
}
pad(6.0, 2.0, F, 0.21, 820);
for (let k = 0; k < 8; k++) {
  const t = 6.0 + k * E8;
  kick(t % 1 === 0 ? t : t, k % 2 === 0 ? 0.9 : 0.55);
  sidechain(t, 0.36);
}
snare(6.5, 0.6);
snare(7.5, 0.62);
for (let s = 0; s < 32; s++) hat(6.0 + s * S16 / 2, s % 8 === 0 ? 0.18 : 0.08, false, (s % 2 ? 0.3 : -0.3));
for (let k = 0; k < 8; k++) bass(6.0 + k * E8, k % 2 ? 45 : 33, 0.22, 0.26);
// 节点闪
{
  const penta = [69, 72, 74, 76, 79, 81];
  for (let i = 0; i < 16; i++) {
    const t = 6.0 + i * S16 * 2;
    if (t >= 8) break;
    pluck(t, penta[(i * 3) % penta.length], 0.075, (i % 2 ? 0.5 : -0.5), 0.4);
  }
}

// 8–10s 仪表
whoosh(7.88, 0.4, 0.3, -0.6, 0.6);
crash(8.0, 0.36, 2.0);
pad(8.0, 2.0, Cc, 0.2, 900);
for (let k = 0; k < 4; k++) {
  kick(8.0 + k * BEAT, k === 0 ? 0.95 : 0.8);
  sidechain(8.0 + k * BEAT, 0.4);
}
snare(8.5, 0.62);
snare(9.5, 0.68);
for (let s = 0; s < 32; s++) hat(8.0 + s * S16 / 2, s % 8 === 0 ? 0.2 : 0.09, false, (s % 2 ? 0.28 : -0.28));
for (let i = 0; i < 16; i++) pluck(8.0 + i * S16, Cc[(i * 3) % 4] + 12, 0.085, (i % 2 ? 0.55 : -0.55), 0.45);
for (let k = 0; k < 4; k++) {
  bell(8.0 + k * BEAT, 96, 0.055, 0.4, 0.7);
}

// 10–12s 词柱
whoosh(9.86, 0.42, 0.36, 0.65, -0.65);
pad(10.0, 2.0, G, 0.21, 860);
for (let k = 0; k < 4; k++) {
  kick(10.0 + k * BEAT, 0.9);
  sidechain(10.0 + k * BEAT, 0.42);
}
snare(10.5, 0.65);
snare(11.0, 0.5);
snare(11.25, 0.55);
snare(11.5, 0.62);
snare(11.625, 0.5);
snare(11.75, 0.66);
snare(11.875, 0.55);
for (let s = 0; s < 32; s++) hat(10.0 + s * S16 / 2, s % 8 === 0 ? 0.2 : 0.1, false, (s % 2 ? 0.3 : -0.3));
for (let k = 0; k < 8; k++) bass(10.0 + k * E8, k % 2 ? 43 : 55, 0.22, 0.28);
for (let i = 0; i < 16; i++) pluck(10.0 + i * S16, G[(i * 3) % 4] + 12, 0.08, (i % 2 ? -0.5 : 0.5), 0.4);
riser(11.0, 1.0, 0.18);

// 12–14s 故障
glitch(12.0, 0.55, 0.34);
glitch(12.62, 0.3, 0.28, 0.4);
glitch(13.1, 0.45, 0.3, -0.4);
glitch(13.72, 0.22, 0.24);
pad(12.0, 2.0, Am, 0.16, 700);
kick(12.0, 0.9);
kick(12.25, 0.55);
kick(12.75, 0.8);
kick(13.0, 0.92);
kick(13.5, 0.7);
for (let i = 0; i < 8; i++) hat(12.0 + i * E8 + (i % 3) * 0.015, 0.11, false, (i % 2 ? 0.35 : -0.35));
riser(12.6, 1.4, 0.22);

// 14–16s 爆点
impact(14.0, 1.0);
sidechain(14.0, 0.5, 0.3);
pad(14.0, 2.0, F, 0.22, 800);
for (let i = 0; i < 190; i++) {
  if (i % 9 === 0 && i < 120) tick(14.0 + 0.03 + i * 0.0035, 0.02, (rnd() - 0.5), 5200);
}
kick(15.0, 0.8);
snare(15.5, 0.6);
for (let s = 0; s < 16; s++) hat(14.0 + s * S16, s % 4 === 0 ? 0.14 : 0.07, false, (s % 2 ? 0.25 : -0.25));
bass(14.0, 41, 1.0, 0.3);
bass(15.0, 41, 0.5, 0.24);

// 16–18s 快剪
pad(16.0, 2.0, G, 0.2, 880);
for (let k = 0; k < 4; k++) {
  const t = 16.0 + k * E8;
  kick(t, 0.92);
  sidechain(t, 0.38);
  slam(t, 0.4);
  tick(t + 0.005, 0.1, 0, 4200);
}
snare(16.5, 0.55);
snare(17.5, 0.6);
for (let s = 0; s < 32; s++) hat(16.0 + s * S16 / 2, s % 8 === 0 ? 0.18 : 0.09, false, (s % 2 ? 0.3 : -0.3));
for (let i = 0; i < 16; i++) pluck(16.0 + i * S16, G[(i * 3) % 4] + 12, 0.075, (i % 2 ? 0.45 : -0.45), 0.35);

// 18–20s 蓄力
pad(18.0, 2.0, Am, 0.24, 1100);
for (let k = 0; k < 4; k++) {
  kick(18.0 + k * BEAT, 0.95);
  sidechain(18.0 + k * BEAT, 0.44);
}
for (let k = 0; k < 16; k++) bass(18.0 + k * E8, k % 4 === 3 ? 45 : 33, 0.2, 0.3);
for (let i = 0; i < 64; i++) {
  const t = 18.0 + i * S16 / 2;
  if (t >= 19.9) break;
  hat(t, i % 8 === 0 ? 0.16 : 0.08, false, (i % 2 ? 0.32 : -0.32));
}
// 军鼓渐密
for (let i = 0; i < 40; i++) {
  const t = 18.5 + i * 0.035;
  if (t >= 19.9) break;
  snare(t, 0.16 + 0.5 * ((t - 18.5) / 1.4), 0.05);
}
riser(18.0, 2.0, 0.34);
// 断点：19.66 之后什么都不放，留 0.34s 真空
glitch(19.6, 0.06, 0.14);

// 20–22s 撞击
impact(20.0, 1.0);
sidechain(20.0, 0.55, 0.34);
pad(20.0, 2.0, Am, 0.26, 950);
bass(20.0, 33, 1.0, 0.34);
bass(21.0, 33, 0.4, 0.3);
bass(21.5, 33, 0.4, 0.28);
kick(20.0, 0.85);
kick(21.0, 0.9);
kick(21.5, 0.85);
snare(20.5, 0.62);
snare(21.5, 0.58);
for (let s = 0; s < 8; s++) hat(20.0 + s * E8, s % 2 ? 0.08 : 0.14, false, (s % 2 ? 0.3 : -0.3));
bell(20.0, 81, 0.16, -0.2, 2.0);
bell(21.0, 88, 0.12, 0.25, 1.8);

// 22–24s 片尾（转 A 大调）
pad(22.0, 2.0, Aa, 0.3, 1400);
bass(22.0, 33, 1.6, 0.22);
kick(22.0, 0.55, { f0: 130, dec: 10 });
{
  const bells = [81, 85, 88, 93, 97];
  for (let i = 0; i < 16; i++) {
    const t = 22.0 + i * E8;
    if (t >= 23.9) break;
    bell(t, bells[(i * 2) % bells.length], 0.05, (i % 2 ? 0.45 : -0.45), 2.0);
  }
}
for (let i = 0; i < 8; i++) pluck(22.0 + i * S16 * 2, Aa[(i * 3) % 4] + 12, 0.05, (i % 2 ? -0.4 : 0.4), 0.5);
impact(23.0, 0.42);
riser(22.2, 0.8, 0.1);
bell(23.0, 105, 0.08, 0, 1.0);

/* ---------- 混响（Schroeder） ---------- */

function revChannel(input, spread) {
  const out = new Float32Array(N);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => {
    const len = Math.max(16, Math.round((d + spread) * SR));
    return { buf: new Float32Array(len), i: 0, f: 0 };
  });
  const aps = [0.005, 0.0017].map((d) => {
    const len = Math.max(8, Math.round((d + spread * 0.5) * SR));
    return { buf: new Float32Array(len), i: 0 };
  });
  const fb = 0.82;
  const damp = 0.26;
  for (let n = 0; n < N; n++) {
    const x = input[n];
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.f = y * (1 - damp) + c.f * damp;
      c.buf[c.i] = x * 0.25 + c.f * fb;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    s *= 0.25;
    for (const a of aps) {
      const y = a.buf[a.i];
      const v = s + y * 0.5;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.buf.length;
      s = y - v * 0.5;
    }
    out[n] = s;
  }
  return out;
}

const wetL = revChannel(BUS.verb[0], 0);
const wetR = revChannel(BUS.verb[1], 0.0013);

/* ---------- 总控 ---------- */

const outL = new Float32Array(N);
const outR = new Float32Array(N);
const hpL = new BQ(); hpL.set('hp', 26, 0.7);
const hpR = new BQ(); hpR.set('hp', 26, 0.7);
let peak = 0;

for (let i = 0; i < N; i++) {
  const m = duck[i];
  let l = BUS.drums[0][i] * 0.95 + BUS.music[0][i] * m * 0.9 + BUS.sfx[0][i] * 0.85 + wetL[i] * 0.34;
  let r = BUS.drums[1][i] * 0.95 + BUS.music[1][i] * m * 0.9 + BUS.sfx[1][i] * 0.85 + wetR[i] * 0.34;
  l = hpL.p(l);
  r = hpR.p(r);
  outL[i] = Math.tanh(l * 1.08);
  outR[i] = Math.tanh(r * 1.08);
  const a = Math.max(Math.abs(outL[i]), Math.abs(outR[i]));
  if (a > peak) peak = a;
}

const norm = 0.80 / (peak || 1);
let sum = 0;
for (let i = 0; i < N; i++) {
  outL[i] *= norm;
  outR[i] *= norm;
  sum += outL[i] * outL[i] + outR[i] * outR[i];
}
// 首尾各 6ms / 240ms 淡入淡出，避免爆音
const fin = Math.round(0.006 * SR);
const fout = Math.round(0.24 * SR);
for (let i = 0; i < fin; i++) {
  outL[i] *= i / fin;
  outR[i] *= i / fin;
}
for (let i = 0; i < fout; i++) {
  const g = i / fout;
  outL[N - 1 - i] *= g;
  outR[N - 1 - i] *= g;
}

const rms = Math.sqrt(sum / (N * 2));
const db = (v) => (v <= 1e-9 ? -999 : 20 * Math.log10(v));

/* ---------- 写 WAV ---------- */

function writeWav(file) {
  const bytes = 44 + N * 4;
  const buf = Buffer.alloc(bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(bytes - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(N * 4, 40);
  let o = 44;
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(outL[i] * 32767))), o);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(outR[i] * 32767))), o + 2);
    o += 4;
  }
  fs.writeFileSync(file, buf);
}

const dir = path.resolve(process.cwd(), 'public', 'audio');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'score.wav');
writeWav(file);

console.log('score.wav  ->', file);
console.log(`duration   : ${DUR.toFixed(3)} s  (${N} samples @ ${SR} Hz, stereo 16-bit)`);
console.log(`peak       : ${db(norm * peak).toFixed(2)} dBFS`);
console.log(`rms        : ${db(rms).toFixed(2)} dBFS  (~${(db(rms) + 3).toFixed(1)} LUFS 估算)`);
console.log(`size       : ${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB`);
console.log('cues       : 0.5 ignition · 2.0 terminal · 4.0/4.5/5.0/5.5 slams · 6.0 neural · 8.0 hud');
console.log('             10.0 stack · 12.0 glitch · 14.0 burst · 16.0-17.5 montage · 18.0 build');
console.log('             20.0 IMPACT · 22.0 finale chord · 23.0 out');
