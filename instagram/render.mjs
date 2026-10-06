// Captura o video.html quadro a quadro e monta o MP4 com o ffmpeg.
// Uso: node render.mjs [saida.mp4]   (precisa de puppeteer-core, do Edge e do ffmpeg no PATH)
// Só alguns instantes, em PNG, pra conferir: node render.mjs --stills 2,7,12
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// PUPPETEER_DIR aponta pra uma pasta com node_modules, caso o puppeteer-core não esteja instalado aqui
const require = createRequire(path.join(process.env.PUPPETEER_DIR || here, "x.js"));
const puppeteer = require("puppeteer-core");

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
// ROTEIRO=promo escolhe o vídeo (padrão: anuncio); o áudio vem de audio/<roteiro>/
const ROTEIRO = process.env.ROTEIRO || "anuncio";
const args = process.argv.slice(2);
const stills = args[0] === "--stills" ? args[1].split(",").map(Number) : null;
const out = stills ? null : path.resolve(args[0] || path.join(here, `outubro-rosa-${ROTEIRO}.mp4`));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
// SEM_LEGENDA=1 tira a legenda queimada no vídeo (pro projeto do Remotion pôr a dele por cima)
await page.goto(pathToFileURL(path.join(here, "video.html")).href + "?frame&v=" + ROTEIRO + (process.env.SEM_LEGENDA ? "&semlegenda" : ""), { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
// TL: cada fala (arquivo e instante em que entra), gerada pelo narrate.mjs
const { DUR, FPS, TL } = await page.evaluate(() => ({ DUR: window.DUR, FPS: window.FPS, TL: window.AUDIOS || null }));

if (stills) {
  for (const t of stills) {
    await page.evaluate((t) => window.seek(t), t);
    await page.screenshot({ path: path.join(process.env.STILLS_DIR || here, `still-${t}.png`) });
  }
} else {
  // áudio: cada fala da narração entra no seu instante; sem narração, trilha muda
  // (o Instagram trata melhor vídeo que tem faixa de áudio)
  // a trilha (music.mjs), se existir, fica por baixo e abaixa sozinha quando a voz fala
  const trilha = path.join(here, "audio", ROTEIRO, "trilha.wav");
  const temTrilha = TL && fs.existsSync(trilha), m = TL ? TL.length + 1 : 0;
  const voz = TL && TL.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(";") +
    ";" + TL.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${TL.length}:normalize=0,aresample=44100,aformat=channel_layouts=stereo,volume=1.15`;
  const audio = TL
    ? [...TL.flatMap((c) => ["-i", path.join(here, "audio", ROTEIRO, c.file)]), ...(temTrilha ? ["-i", trilha] : []),
       "-filter_complex", temTrilha
         ? `${voz},apad,asplit[voz][chave];[${m}:a]volume=0.32[mus];[mus][chave]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450[duck];` +
           `[voz][duck]amix=inputs=2:normalize=0:duration=shortest,volume=1.45,alimiter=limit=0.95,apad[mix]`
         : `${voz},apad[mix]`,
       "-map", "0:v", "-map", "[mix]"]
    : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const total = Math.round(DUR * FPS);
  const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", ...audio,
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-t", (total / FPS).toFixed(3), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 90 === 0) console.log(`quadro ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("pronto:", out);
}
await browser.close();
