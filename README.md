# Outubro Rosa — Grupo Dias

Landing page de campanha, 100% frontend, em um único `index.html` (HTML + CSS + JS puro, sem build).

## Rodar local

```
node serve.js
```

Abre em http://localhost:5173. Qualquer servidor estático funciona (Live Server do VS Code também).

## Estrutura

- `index.html` — página inteira: estilos, markup e o motor de animação.
- `assets/sky.png` — céu rosa usado no hero e no CTA (parallax).
- `assets/p1.png`, `p2.png`, `p3.png` — colaboradoras do Grupo Dias.
- `serve.js` — servidor estático mínimo pra desenvolvimento.

## Motion

- Loader com barra de progresso que sobe como cortina e libera as animações do hero.
- Textos revelados por clip-mask (palavra a palavra no título, linha a linha nos demais).
- Springs em JS (`tension`/`friction`) pra entradas e hover.
- Parallax de scroll no céu, nos cards do time e na palavra fantasma "Prevenir".
- Scroll suave via Lenis (CDN). `prefers-reduced-motion` respeitado.

## Antes de publicar

- Trocar o número do WhatsApp no botão "Falar com o Grupo Dias" (`wa.me/55...`).
- Trocar o ícone de laço do header pelo logo oficial do Grupo Dias, se quiser.
