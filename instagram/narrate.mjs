// Gera a narração (uma fala por cena) com a voz neural do Edge e salva em audio/,
// junto com o timeline.js (tempo de cada cena e das legendas) que o video.html e o render.mjs usam.
// Uso: node narrate.mjs   (precisa de msedge-tts; PUPPETEER_DIR aponta pra pasta com node_modules)
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.env.PUPPETEER_DIR || here, "x.js"));
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const VOZ = process.env.VOZ || "pt-BR-FranciscaNeural";
// `fala` é o que a voz diz (números por extenso); `legenda` é o que aparece escrito, na mesma ordem de palavras.
const CENAS = [
  { fala: "Outubro é rosa. E cuidar de você é um ato de amor." },
  { fala: "Quando o câncer de mama é descoberto cedo, a chance de cura chega a noventa e cinco por cento. Conhecer o seu corpo e manter os exames em dia salva vidas.",
    legenda: "Quando o câncer de mama é descoberto cedo, a chance de cura chega a 95%. Conhecer o seu corpo e manter os exames em dia salva vidas." },
  { fala: "Por isso, neste mês, nós da Clínica Dias vestimos rosa. Para lembrar que cuidar de si não pode esperar." },
  { fala: "E preparamos um pacote completo para você: dez exames laboratoriais, ultrassom de mamas e axilas e consulta ginecológica.",
    legenda: "E preparamos um pacote completo para você: 10 exames laboratoriais, ultrassom de mamas e axilas e consulta ginecológica." },
  { fala: "Tudo isso a partir de duzentos e oitenta reais, no dinheiro ou no Pix.",
    legenda: "Tudo isso a partir de R$ 280, no dinheiro ou no Pix." },
  { fala: "Agende o seu check-up rosa. Chame a Clínica Dias no WhatsApp." },
];

const dir = path.join(here, "audio");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const tts = new MsEdgeTTS();
await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { sentenceBoundaryEnabled: true });
const out = [];
for (let i = 0; i < CENAS.length; i++) {
  const tmp = path.join(dir, "tmp" + i);
  fs.mkdirSync(tmp);
  const r = await tts.toFile(tmp, CENAS[i].fala);
  const file = `cena${i + 1}.mp3`;
  fs.renameSync(r.audioFilePath, path.join(dir, file));
  fs.rmSync(tmp, { recursive: true, force: true });
  out.push({ file, fala: CENAS[i].fala, legenda: CENAS[i].legenda || CENAS[i].fala });
  console.log(file);
}
tts.close();

// ---- linha do tempo: cada cena dura o tempo da sua fala; a legenda é fatiada e distribuída pela fala ----
const LEAD = 0.45, TAIL = 0.55, FIM = 1.6, MIN = 5.8;
const POR_EXTENSO = [["95%", "noventa e cinco por cento"], ["R$ 280", "duzentos e oitenta reais"], ["10 ", "dez "]];
const peso = (s) => {
  for (const [a, b] of POR_EXTENSO) s = s.replace(a, b);
  return s.length + (s.match(/[.!?]/g) || []).length * 7 + (s.match(/[,:]/g) || []).length * 4;
};
function fatiar(texto) {
  const fatias = []; let atual = [];
  for (const p of texto.split(/\s+/)) {
    atual.push(p);
    const s = atual.join(" ");
    // não quebra logo depois de palavrinha de ligação ("de", "e", "que"...)
    if (/[.!?,:]$/.test(p) || ((s.length >= 20 || atual.length >= 4) && p.length > 3)) { fatias.push(s); atual = []; }
  }
  if (atual.length) fatias.push(atual.join(" "));
  // palavra solta no fim de uma frase volta pra fatia anterior
  for (let i = fatias.length - 1; i > 0; i--) if (!fatias[i].includes(" ") && fatias[i].length < 9 && !/[.!?,:]$/.test(fatias[i - 1])) { fatias[i - 1] += " " + fatias[i]; fatias.splice(i, 1); }
  return fatias;
}
function trechoFalado(file) {
  const p = path.join(dir, file);
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString());
  const log = spawnSync("ffmpeg", ["-i", p, "-af", "silencedetect=noise=-38dB:d=0.15", "-f", "null", "-"]).stderr.toString();
  const ini = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const fim = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const a = ini[0] !== undefined && ini[0] < 0.05 && fim[0] ? fim[0] : 0;
  const b = ini.length && (fim.length < ini.length || fim[fim.length - 1] > dur - 0.05) ? ini[ini.length - 1] : dur;
  return { a, b, dur };
}
let t = 0;
const cenas = out.map((c, i) => {
  const { a, b } = trechoFalado(c.file);
  const s = t, audioAt = s + LEAD;
  const e = Math.max(s + MIN, audioAt + b + TAIL + (i === out.length - 1 ? FIM : 0));
  const fatias = fatiar(c.legenda), total = fatias.reduce((n, f) => n + peso(f), 0);
  let k = audioAt + a;
  const legendas = fatias.map((f) => { const t0 = k; k += ((b - a) * peso(f)) / total; return { t0: +t0.toFixed(3), t1: +k.toFixed(3), texto: f }; });
  t = e;
  return { s: +s.toFixed(3), e: +e.toFixed(3), audioAt: +audioAt.toFixed(3), file: c.file, legendas };
});
fs.writeFileSync(path.join(dir, "timeline.js"), "window.TIMELINE=" + JSON.stringify(cenas, null, 1) + ";\n");
console.log("duração total:", t.toFixed(2) + "s");
