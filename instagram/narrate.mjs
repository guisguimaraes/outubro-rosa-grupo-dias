// Gera a narração com a voz neural do Edge e salva em audio/, junto com o timeline.js
// (tempo de cada cena, de cada fala e de cada palavra da legenda, e o volume da voz quadro a quadro)
// que o video.html, o music.mjs e o render.mjs usam.
// Uso: node narrate.mjs [anuncio|promo]   (precisa de msedge-tts; PUPPETEER_DIR aponta pra pasta com node_modules)
//
// Cada frase é um áudio separado, com tom e velocidade próprios, e as pausas entre elas são nossas:
// o Edge gratuito não aceita SSML (pausa ou entonação no meio da frase), então a naturalidade vem daqui.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.env.PUPPETEER_DIR || here, "x.js"));
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const VOZ = process.env.VOZ || "pt-BR-FranciscaNeural";
const TOM = process.env.TOM || "+12Hz"; // um pouco mais aguda e leve que a voz padrão
const FPS = 30;
// Roteiro: node narrate.mjs promo  →  roteiros/promo.mjs, saída em audio/promo/ (padrão: anuncio)
const ROTEIRO = process.argv[2] || process.env.ROTEIRO || "anuncio";
const CENAS = (await import(`./roteiros/${ROTEIRO}.mjs`)).default;

// cada palavra da legenda e quantas palavras faladas ela ocupa
function palavras(frase) {
  const out = [];
  for (const m of frase.matchAll(/\{([^|}]+)\|([^}]+)\}(\S*)|(\S+)/g)) {
    if (m[4]) out.push({ texto: m[4], falado: [m[4]] });
    else out.push({ texto: m[1] + m[3], falado: (m[2] + m[3]).split(/\s+/) });
  }
  return out;
}
const fala = (frase) => palavras(frase).flatMap((p) => p.falado).join(" ");
const limpa = (s) => s.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");

const dir = path.join(here, "audio", ROTEIRO);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

async function sintetiza(texto, rate, pitch, file) {
  // uma conexão por frase: o Edge às vezes fecha o socket no meio de uma sequência longa
  for (let tentativa = 1; ; tentativa++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const tmp = fs.mkdtempSync(path.join(dir, "tmp"));
      const r = await tts.toFile(tmp, texto, { rate, pitch });
      fs.renameSync(r.audioFilePath, path.join(dir, file));
      const ditas = JSON.parse(fs.readFileSync(r.metadataFilePath, "utf8")).Metadata
        .filter((m) => m.Type === "WordBoundary")
        .map((m) => ({ w: limpa(m.Data.text.Text), t0: m.Data.Offset / 1e7, t1: (m.Data.Offset + m.Data.Duration) / 1e7 }))
        .filter((d) => d.w);
      fs.rmSync(tmp, { recursive: true, force: true });
      return ditas;
    } catch (e) {
      if (tentativa >= 4) throw e;
      console.log("  tentando de novo:", e.message);
    } finally {
      tts.close();
    }
  }
}

// casa cada palavra da legenda com as palavras faladas correspondentes
function alinhar(frase, ditas) {
  let j = 0;
  return palavras(frase).map((p) => {
    const alvo = p.falado.map(limpa).filter(Boolean);
    let k = ditas.findIndex((d, n) => n >= j && d.w === alvo[0]);
    if (k < 0) k = Math.min(j, ditas.length - 1);
    const ini = ditas[k], fim = ditas[Math.min(k + alvo.length - 1, ditas.length - 1)];
    j = k + alvo.length;
    return { texto: p.texto, t0: ini.t0, t1: fim.t1 };
  });
}
// blocos curtos de legenda: quebra na pontuação ou a cada ~15 letras, sem terminar em palavrinha de ligação
const LIGA = new Set(["de", "o", "a", "e", "é", "um", "no", "por", "ou", "seu", "este", "tem", "até", "que", "não", "pra", "pelo", "foi", "se"]);
function blocos(ws) {
  const res = []; let atual = [];
  ws.forEach((w, i) => {
    atual.push(w);
    const letras = atual.map((x) => x.texto).join(" ").length, prox = ws[i + 1];
    if (/[.!?,:]$/.test(w.texto) || ((letras >= 14 || atual.length >= 4) && !LIGA.has(w.texto.toLowerCase()) && prox)) { res.push(atual); atual = []; }
  });
  if (atual.length) res.push(atual);
  // palavra solta no fim volta pro bloco anterior
  for (let i = res.length - 1; i > 0; i--) if (res[i].length === 1 && res[i][0].texto.length < 6 && !/[.!?,:]$/.test(res[i - 1].at(-1).texto)) { res[i - 1].push(...res[i]); res.splice(i, 1); }
  return res;
}
const duracao = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(dir, file)]).toString());
// volume (RMS) da fala a cada quadro, pro fundo reagir à voz
function envelope(file) {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(dir, file), "-f", "f32le", "-ac", "1", "-ar", "24000", "-"], { maxBuffer: 1 << 28 });
  const s = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length)), n = 24000 / FPS, out = [];
  for (let i = 0; i < s.length; i += n) {
    let a = 0; for (let k = i; k < Math.min(i + n, s.length); k++) a += s[k] * s[k];
    out.push(Math.sqrt(a / n));
  }
  return out;
}

// cena começa, a transição roda por LEAD segundos e só então entra a voz
const LEAD = 0.4, TAIL = 0.25, FIM = 2.6;
let t = 0, n = 0;
const audios = [], cenas = [];
for (const [ci, cena] of CENAS.entries()) {
  const s = t;
  let k = s + LEAD;
  const ws = [];
  for (const f of cena.falas) {
    const file = `fala${++n}.mp3`;
    const ditas = await sintetiza(fala(f.t), f.rate || "+0%", f.pitch || TOM, file);
    const at = k;
    ws.push(...alinhar(f.t, ditas).map((w) => ({ ...w, t0: +(at + w.t0).toFixed(3), t1: +(at + w.t1).toFixed(3) })));
    // a próxima frase entra logo depois da última palavra desta, mais a pausa
    const fimFala = at + Math.min(duracao(file), ditas.at(-1).t1 + 0.12);
    audios.push({ file, at: +at.toFixed(3) });
    k = fimFala + f.pausa;
    console.log(file, "→", f.t);
  }
  const e = k + TAIL + (ci === CENAS.length - 1 ? FIM : 0);
  const legendas = blocos(ws).map((b) => ({ t0: b[0].t0 - 0.06, t1: b.at(-1).t1 + 0.25, palavras: b }));
  legendas.forEach((l, i) => { if (legendas[i + 1]) l.t1 = legendas[i + 1].t0; l.t1 = +Math.min(l.t1, e - 0.1).toFixed(3); l.t0 = +l.t0.toFixed(3); });
  cenas.push({ id: cena.id, s: +s.toFixed(3), e: +e.toFixed(3), palavras: ws, legendas });
  t = e;
}

const env = new Array(Math.ceil(t * FPS) + 1).fill(0);
for (const a of audios) envelope(a.file).forEach((v, i) => { const f = Math.round(a.at * FPS) + i; if (f < env.length) env[f] = Math.max(env[f], v); });
const pico = Math.max(...env) || 1;
fs.writeFileSync(path.join(dir, "timeline.js"),
  "window.TIMELINE=" + JSON.stringify(cenas) + ";\n" +
  "window.AUDIOS=" + JSON.stringify(audios) + ";\n" +
  "window.ENV=" + JSON.stringify(env.map((v) => +(v / pico).toFixed(3))) + ";\n");
console.log("duração total:", t.toFixed(2) + "s");
