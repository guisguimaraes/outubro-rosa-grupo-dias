// Post da promoção (feed/Stories, sem anúncio): direto na oferta — pacote, preço no Convênio CardFácil e WhatsApp.
// Mesmo formato do anuncio.mjs.
export default [
  { id: "oferta", falas: [
    { t: "Promoção Outubro Rosa!", rate: "+6%", pitch: "+17Hz", pausa: 0.15 },
    { t: "Pacote completo de exames por {R$ 280|duzentos e oitenta reais}.", rate: "+6%", pitch: "+14Hz", pausa: 0.25 },
  ] },
  { id: "pacote", falas: [
    { t: "São {10|dez} exames laboratoriais,", rate: "+8%", pausa: 0.05 },
    { t: "ultrassom de mamas e axilas,", rate: "+8%", pausa: 0.05 },
    { t: "e consulta ginecológica.", rate: "+8%", pausa: 0.2 },
  ] },
  { id: "card", falas: [
    { t: "Pelo Convênio {CardFácil|Card Fácil}:", rate: "+6%", pitch: "+14Hz", pausa: 0.05 },
    { t: "{R$ 280|duzentos e oitenta reais} no Pix ou dinheiro,", rate: "+3%", pausa: 0.05 },
    { t: "ou {R$ 350|trezentos e cinquenta} no cartão.", rate: "+5%", pausa: 0.2 },
  ] },
  { id: "cta", falas: [
    { t: "Chame a Clínica Dias no WhatsApp e agende o seu!", rate: "+8%", pitch: "+15Hz", pausa: 0 },
  ] },
];
