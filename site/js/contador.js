// contador.js
// Conta as visitas do site com o GoatCounter (goatcounter.com): grátis, sem cookies e sem
// guardar dados pessoais de quem visita (por isso o site não precisa de aviso de cookies).
// Os números aparecem no painel local painel/acessos.html (que não é publicado).
//
// Para ligar: crie a conta no GoatCounter e escreva abaixo o código escolhido
// (o "probcom" de probcom.goatcounter.com). Enquanto estiver vazio, nada é contado.
// O código não é segredo: ele aparece em qualquer site que usa o GoatCounter.
const CODIGO = "";

// Só conta no site publicado: visitas no seu computador (localhost) não entram nos números.
const NO_COMPUTADOR = ["localhost", "127.0.0.1", "[::1]"];

export function iniciarContador() {
  if (!CODIGO || NO_COMPUTADOR.includes(location.hostname) || document.querySelector("[data-goatcounter]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = `https://${CODIGO}.goatcounter.com/count`;
  document.head.append(script);
}
