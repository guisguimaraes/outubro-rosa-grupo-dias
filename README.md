# Outubro Rosa — Grupo Dias

Landing page de campanha em um único `index.html` (HTML + CSS + JS puro, sem build), servida por um `server.js` em Node que também conta visitas e cliques no WhatsApp e mostra tudo num painel em `/admin`.

## Rodar local

```
node server.js
```

Abre em http://localhost:3000. Precisa do Node 22.13 ou mais novo (usa o SQLite que já vem no Node, sem instalar nada).

Pra abrir o painel local: `ADMIN_PASSWORD=teste node server.js` e acessar http://localhost:3000/admin (usuário `admin`). Os dados locais ficam em `data/`, fora do git.

## Painel de cliques (/admin)

- Cada abertura do site conta uma visita; cada toque num botão de WhatsApp conta um clique, com o nome do botão (atributo `data-wa` no link).
- Pessoas diferentes são contadas por um código aleatório guardado no navegador. Não grava IP, nome nem telefone.
- A origem vem do `utm_source` do link (ex.: `?utm_source=instagram`) ou, sem ele, do site de onde a pessoa veio.
- Botão novo de WhatsApp: coloque `data-wa="nome"` no link e adicione o nome em `BOTOES` no `server.js` e no `admin.html`.

### No Coolify

- **Ports exposes:** 3000.
- **Variáveis:** `ADMIN_PASSWORD` (obrigatória pro painel funcionar) e, se quiser, `ADMIN_USER` (padrão `admin`).
- **Persistent Storage:** um volume montado em `/data`. Sem ele, os números zeram a cada deploy.

## Estrutura

- `index.html` — página inteira: estilos, markup e o motor de animação.
- `assets/sky.png` — céu rosa usado no hero e no CTA (parallax).
- `assets/p1.png`, `p2.png`, `p3.png` — colaboradoras do Grupo Dias.
- `server.js` — servidor do site, contador de visitas e cliques e API do painel.
- `admin.html` — painel com visitas, cliques no WhatsApp, botões, origens e aparelhos.

## Motion

- Loader com barra de progresso que sobe como cortina e libera as animações do hero.
- Textos revelados por clip-mask (palavra a palavra no título, linha a linha nos demais).
- Springs em JS (`tension`/`friction`) pra entradas e hover.
- Parallax de scroll no céu, nos cards do time e na palavra fantasma "Prevenir".
- Scroll suave via Lenis (CDN). `prefers-reduced-motion` respeitado.

## Antes de publicar

- Trocar o número do WhatsApp no botão "Falar com o Grupo Dias" (`wa.me/55...`).
- Trocar o ícone de laço do header pelo logo oficial do Grupo Dias, se quiser.
