// Sintetiza a trilha (audio/<roteiro>/trilha.wav) na duração do vídeo: pad suave, arpejo e um sininho
// na mesma tonalidade marcando cada troca de cena. Lê o audio/<roteiro>/timeline.js gerado pelo narrate.mjs.
// Uso: node music.mjs [anuncio|promo]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROTEIRO = process.argv[2] || process.env.ROTEIRO || "anuncio";
const window = {};
new Function("window", fs.readFileSync(path.join(here, "audio", ROTEIRO, "timeline.js"), "utf8"))(window);
const TL = window.TIMELINE;
const DUR = TL.at(-1).e;

const SR = 44100, N = Math.ceil(DUR * SR) + SR;
const L = new Float32Array(N), R = new Float32Array(N);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const BEAT = 60 / 96;
// Ré maior: D – Bm – G – A, um compasso (quatro tempos) cada
const ACORDES = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
const BAR = BEAT * 4;

function nota(t0, dur, f, amp, pan, timbre) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const gl = Math.cos(pan * Math.PI / 4 + Math.PI / 4), gr = Math.sin(pan * Math.PI / 4 + Math.PI / 4);
  for (let k = 0; k < n && i0 + k < N; k++) {
    const t = k / SR, v = timbre(t, f, dur) * amp;
    L[i0 + k] += v * gl; R[i0 + k] += v * gr;
  }
}
const pad = (t, f, d) => {
  const env = Math.min(1, t / 0.9) * Math.min(1, (d - t) / 1.2);
  return env * (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t) * .8 + Math.sin(2 * Math.PI * f * 2 * t) * .12) / 2;
};
const pluck = (t, f) => Math.exp(-t * 7) * Math.min(1, t / .004) * (Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 14));
const sino = (t, f) => Math.exp(-t * 2.2) * Math.min(1, t / .003) * (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 5) + .2 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 9));
const kick = (t) => Math.exp(-t * 18) * Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-t * 30)) * t);

const fimMusica = DUR - 0.2;
for (let b = 0; b * BAR < fimMusica; b++) {
  const t0 = b * BAR, ac = ACORDES[b % 4], ultimo = (b + 1) * BAR >= fimMusica - BAR;
  const dur = ultimo ? fimMusica - t0 + .5 : BAR + 1;
  ac.forEach((m, i) => nota(t0, dur, hz(m), .09, (i - 1.5) * .5, pad));
  if (ultimo) { nota(t0, dur, hz(ac[0] - 12), .1, 0, pad); break; }
  // arpejo em colcheias, entra depois do gancho
  if (t0 >= BAR) {
    const seq = [ac[0] + 12, ac[2] + 12, ac[3] + 12, ac[1] + 24, ac[3] + 12, ac[2] + 12, ac[1] + 12, ac[2] + 12];
    seq.forEach((m, k) => nota(t0 + k * BEAT / 2, .9, hz(m), k % 2 ? .035 : .05, k % 2 ? .5 : -.5, pluck));
  }
  // pulso grave bem leve a partir da segunda cena
  if (t0 >= TL[1].s - .1) for (let k = 0; k < 4; k += 2) nota(t0 + k * BEAT, .4, 0, .22, 0, kick);
}
// sininho em cada troca de cena (notas do acorde que está tocando)
TL.forEach((c, i) => {
  const ac = ACORDES[Math.floor(c.s / BAR) % 4];
  nota(c.s + .02, 2.5, hz(ac[i % 2 ? 2 : 0] + 24), .06, i % 2 ? .4 : -.4, sino);
});

// whoosh suave em cada transição: ruído filtrado que abre e fecha, passando de um lado pro outro
let semente = 1;
const ruido = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;
TL.slice(1).forEach((c, i) => {
  const i0 = Math.floor((c.s - 0.28) * SR), n = Math.floor(0.75 * SR);
  let lp = 0, lp2 = 0;
  for (let k = 0; k < n && i0 + k < N; k++) {
    const p = k / n, corte = 0.02 + 0.22 * Math.sin(Math.PI * p);
    lp += (ruido() - lp) * corte; lp2 += (lp - lp2) * corte;
    const v = (lp2 - lp * 0.3) * Math.pow(Math.sin(Math.PI * p), 2) * 0.16;
    const pan = i % 2 ? p : 1 - p;
    L[i0 + k] += v * (1 - pan * 0.6); R[i0 + k] += v * (0.4 + pan * 0.6);
  }
});

// eco + reverb simples (Schroeder) pra tudo morar no mesmo espaço
function reverb(x) {
  const out = new Float32Array(x.length);
  for (const [d, g] of [[1557, .78], [1617, .77], [1491, .79], [1422, .8]]) {
    const buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < x.length; i++) { const y = buf[p]; buf[p] = x[i] + y * g; p = (p + 1) % d; out[i] += y * .25; }
  }
  for (const [d, g] of [[225, .5], [556, .5]]) {
    const buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < x.length; i++) { const b = buf[p], y = -g * out[i] + b; buf[p] = out[i] + g * y; out[i] = y; p = (p + 1) % d; }
  }
  return out;
}
const eco = Math.floor(BEAT * .75 * SR);
for (let i = eco; i < N; i++) { L[i] += R[i - eco] * .22; R[i] += L[i - eco] * .22; }
const wl = reverb(L), wr = reverb(R);
let pico = 0;
for (let i = 0; i < N; i++) { L[i] = L[i] * .8 + wl[i] * .3; R[i] = R[i] * .8 + wr[i] * .3; pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i])); }

// fade de saída e normalização em -1 dB
const total = Math.ceil(DUR * SR), ganho = .89 / pico;
const wav = Buffer.alloc(44 + total * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + total * 4, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(total * 4, 40);
for (let i = 0; i < total; i++) {
  const f = Math.min(1, i / (SR * .3)) * Math.min(1, (total - i) / (SR * 1.5)) * ganho;
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * f)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * f)) * 32767), 46 + i * 4);
}
fs.writeFileSync(path.join(here, "audio", ROTEIRO, "trilha.wav"), wav);
console.log("trilha:", DUR.toFixed(2) + "s");
