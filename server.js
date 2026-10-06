// Servidor do site + contador de visitas e cliques no WhatsApp + painel /admin.
// Sem dependências: Node 22.13+ (usa node:sqlite).
//   node server.js                         →  http://localhost:3000
//   ADMIN_PASSWORD=... node server.js      →  libera o painel em /admin (usuário: ADMIN_USER, padrão "admin")
// Os dados ficam em DATA_DIR/eventos.db (padrão ./data; no Docker, /data, que precisa ser volume persistente).
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Botões de WhatsApp do site (data-wa no index.html). Qualquer outro valor vira "outro".
const BOTOES = new Set(["pacote-card", "pacote-particular", "combo-2", "o-que-inclui", "rodape", "duvidas"]);
const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i;
const BRT = 3 * 3600e3, DIA = 86400e3; // Brasília é UTC-3 fixo (sem horário de verão desde 2019)

fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "eventos.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    tipo TEXT NOT NULL,          -- 'visita' | 'whatsapp'
    botao TEXT,
    visitante TEXT,              -- id aleatório guardado no navegador (sem IP, sem dado pessoal)
    origem TEXT NOT NULL,
    dispositivo TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS eventos_ts ON eventos (ts);
`);
const inserir = db.prepare("INSERT INTO eventos (ts, tipo, botao, visitante, origem, dispositivo) VALUES (?, ?, ?, ?, ?, ?)");

// "l.instagram.com" → "instagram", "www.google.com.br" → "google"; utm_source vem como está
function normalizarOrigem(o) {
  o = String(o || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 60);
  if (!o) return "direto";
  for (const nome of ["instagram", "facebook", "google", "whatsapp", "tiktok", "youtube", "bing"]) if (o.includes(nome)) return nome;
  return o.replace(/^(www|m|l|lm)\./, "");
}

const STATIC = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
function servir(res, file, extra = {}) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": STATIC[path.extname(file)] || "application/octet-stream", ...extra });
    res.end(data);
  });
}

const hash = s => crypto.createHash("sha256").update(s).digest();
function autorizado(req) {
  if (!ADMIN_PASSWORD) return false;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const [u, ...p] = Buffer.from(m[1], "base64").toString().split(":");
  const okU = crypto.timingSafeEqual(hash(u), hash(ADMIN_USER));
  const okP = crypto.timingSafeEqual(hash(p.join(":")), hash(ADMIN_PASSWORD));
  return okU && okP;
}
function pedirSenha(res) {
  if (!ADMIN_PASSWORD) { res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Painel desativado: defina ADMIN_PASSWORD no servidor."); }
  // pequena espera a cada tentativa errada, pra atrasar quem tenta adivinhar a senha
  setTimeout(() => {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Painel Outubro Rosa", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" });
    res.end("Senha necessária.");
  }, 800);
}

function registrar(req, res) {
  let body = "";
  req.on("data", c => { body += c; if (body.length > 2048) req.destroy(); });
  req.on("end", () => {
    res.writeHead(204).end();
    const ua = req.headers["user-agent"] || "";
    if (BOT_UA.test(ua)) return;
    let e; try { e = JSON.parse(body); } catch { return; }
    if (e.tipo !== "visita" && e.tipo !== "whatsapp") return;
    const botao = e.tipo === "whatsapp" ? (BOTOES.has(e.botao) ? e.botao : "outro") : null;
    const visitante = /^[a-z0-9-]{8,40}$/i.test(e.visitante) ? e.visitante : null;
    const dispositivo = /Mobi|Android|iPhone|iPad/i.test(ua) ? "celular" : "computador";
    inserir.run(Date.now(), e.tipo, botao, visitante, normalizarOrigem(e.origem), dispositivo);
  });
}

function estatisticas(dias) {
  const agora = Date.now();
  // início do período: meia-noite de Brasília de (dias - 1) dias atrás; 0 = desde sempre
  const desde = dias > 0 ? Math.floor((agora - BRT) / DIA) * DIA + BRT - (dias - 1) * DIA : 0;
  const q = (sql, ...a) => db.prepare(sql).all(desde, ...a);
  const totais = db.prepare(`SELECT
      SUM(tipo = 'visita') AS visitas,
      COUNT(DISTINCT CASE WHEN tipo = 'visita' THEN visitante END) AS pessoas,
      SUM(tipo = 'whatsapp') AS cliques,
      COUNT(DISTINCT CASE WHEN tipo = 'whatsapp' THEN visitante END) AS pessoasQueClicaram
    FROM eventos WHERE ts >= ?`).get(desde);
  const dia = "strftime('%Y-%m-%d', (ts - 10800000) / 1000, 'unixepoch')";
  return {
    desde, agora,
    totais: Object.fromEntries(Object.entries(totais).map(([k, v]) => [k, v || 0])),
    porDia: q(`SELECT ${dia} AS dia, SUM(tipo = 'visita') AS visitas, SUM(tipo = 'whatsapp') AS cliques FROM eventos WHERE ts >= ? GROUP BY dia ORDER BY dia`),
    porBotao: q("SELECT botao, COUNT(*) AS cliques FROM eventos WHERE ts >= ? AND tipo = 'whatsapp' GROUP BY botao ORDER BY cliques DESC"),
    porOrigem: q("SELECT origem, SUM(tipo = 'visita') AS visitas, SUM(tipo = 'whatsapp') AS cliques FROM eventos WHERE ts >= ? GROUP BY origem ORDER BY visitas DESC, cliques DESC LIMIT 12"),
    porDispositivo: q("SELECT dispositivo, SUM(tipo = 'visita') AS visitas, SUM(tipo = 'whatsapp') AS cliques FROM eventos WHERE ts >= ? GROUP BY dispositivo ORDER BY visitas DESC"),
    ultimos: q("SELECT ts, botao, origem, dispositivo FROM eventos WHERE ts >= ? AND tipo = 'whatsapp' ORDER BY ts DESC LIMIT 25"),
  };
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let p = decodeURIComponent(url.pathname);

  if (p === "/api/evento" && req.method === "POST") return registrar(req, res);

  if (p === "/admin" || p === "/admin/" || p === "/api/stats") {
    if (!autorizado(req)) return pedirSenha(res);
    const privado = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
    if (p === "/api/stats") {
      const dias = [1, 7, 30].includes(Number(url.searchParams.get("dias"))) ? Number(url.searchParams.get("dias")) : 0;
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...privado });
      return res.end(JSON.stringify(estatisticas(dias)));
    }
    return servir(res, path.join(root, "admin.html"), privado);
  }

  // site público: só o index.html e a pasta assets/
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  if (p !== "/index.html" && !file.startsWith(path.join(root, "assets") + path.sep)) { res.writeHead(404); return res.end("not found"); }
  servir(res, file);
}).listen(port, () => console.log(`http://localhost:${port}` + (ADMIN_PASSWORD ? `  ·  painel em /admin` : `  ·  painel desativado (sem ADMIN_PASSWORD)`)));
