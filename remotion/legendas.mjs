// Gera public/outubro-rosa-base.json (legendas palavra por palavra) a partir do timeline.js do instagram/.
// Os tempos vêm da própria voz neural, então não precisa transcrever com o Whisper.
// Uso: node legendas.mjs [anuncio|promo]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROTEIRO = process.argv[2] || "anuncio";
const window = {};
new Function("window", fs.readFileSync(path.join(here, `../instagram/audio/${ROTEIRO}/timeline.js`), "utf8"))(window);

// novoBloco marca onde começa cada bloco curto de legenda (o mesmo corte do vídeo do instagram/)
const palavras = window.TIMELINE.flatMap((cena) => cena.legendas.flatMap((l) => l.palavras.map((p, k) => ({ ...p, novoBloco: k === 0 }))));
const captions = palavras.map((p, i) => ({
  // o createTikTokStyleCaptions separa as palavras pelo espaço no começo do texto
  text: (i === 0 ? "" : " ") + p.texto,
  novoBloco: p.novoBloco,
  startMs: Math.round(p.t0 * 1000),
  endMs: Math.round(p.t1 * 1000),
  timestampMs: Math.round(((p.t0 + p.t1) / 2) * 1000),
  confidence: null,
}));
fs.writeFileSync(path.join(here, "public", "outubro-rosa-base.json"), JSON.stringify(captions, null, 1));
console.log(captions.length, "palavras");
