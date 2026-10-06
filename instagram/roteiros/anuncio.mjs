// Anúncio (tráfego pago, Stories): conscientização + equipe + pacote + Convênio CardFácil + botão do anúncio.
// Cada cena tem o id de uma <section> do video.html. O que aparece escrito na legenda;
// {escrito|falado} é como a voz deve ler um número, valor ou nome.
// rate/pitch por frase dão a entonação; pausa é o respiro depois da frase (s).
export default [
  { id: "gancho", falas: [
    { t: "Quando foi a última vez que você se cuidou de verdade?", rate: "+6%", pitch: "+16Hz", pausa: 0.35 },
  ] },
  { id: "rosa", falas: [
    { t: "Outubro é rosa. E cuidar de você não pode esperar.", rate: "+8%", pausa: 0.2 },
  ] },
  { id: "dado", falas: [
    { t: "Descoberto cedo, o câncer de mama tem até {95%|noventa e cinco por cento} de chance de cura.", rate: "+8%", pausa: 0.25 },
  ] },
  { id: "time", falas: [
    { t: "Por isso, a Clínica Dias preparou um pacote completo pra você!", rate: "+10%", pitch: "+15Hz", pausa: 0.15 },
  ] },
  { id: "pacote", falas: [
    { t: "{10|Dez} exames laboratoriais,", rate: "+8%", pausa: 0.05 },
    { t: "ultrassom de mamas e axilas,", rate: "+8%", pausa: 0.05 },
    { t: "e consulta ginecológica.", rate: "+8%", pausa: 0.2 },
  ] },
  { id: "card", falas: [
    { t: "Pelo Convênio {CardFácil|Card Fácil}:", rate: "+6%", pitch: "+14Hz", pausa: 0.05 },
    { t: "{R$ 280|duzentos e oitenta reais} no Pix ou dinheiro,", rate: "+3%", pausa: 0.05 },
    { t: "ou {R$ 350|trezentos e cinquenta} no cartão.", rate: "+5%", pausa: 0.2 },
  ] },
  { id: "cta", falas: [
    { t: "Toque no botão aqui embaixo e agende pelo WhatsApp!", rate: "+8%", pitch: "+15Hz", pausa: 0 },
  ] },
];
