// Anúncio que leva pra landing page: o mesmo anuncio.mjs, mas fechando com o site em vez do WhatsApp.
import anuncio from "./anuncio.mjs";

export default [
  ...anuncio.filter((c) => c.id !== "cta"),
  { id: "site", falas: [
    { t: "Acesse o nosso site no link abaixo para saber mais informações!", rate: "+8%", pitch: "+15Hz", pausa: 0 },
  ] },
];
