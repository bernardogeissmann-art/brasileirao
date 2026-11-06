// ingressos.js
// As regras do botão "Comprar ingressos", usadas pelos Jogos do dia (página inicial) e pelo
// Meu Time. Só regras: o desenho do botão fica em componentes.js e as cores, no CSS.
//
// Quem vende os ingressos de um jogo é o time da casa (o mandante). O endereço da loja de
// ingressos de cada clube fica em data/ingressos.json. Nenhuma fonte gratuita traz o link de
// cada jogo, então o botão leva à loja oficial do mandante, onde o jogo aparece à venda.

// Lê o data/ingressos.json. Se o arquivo não existir ou falhar, devolve null (e não há botão).
export async function lerIngressos() {
  try {
    const resposta = await fetch(new URL("../../data/ingressos.json", import.meta.url));
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

// O endereço para comprar ingressos de um jogo, ou null quando não há botão:
//   - o jogo já começou (ou já acabou): o botão some na hora do início;
//   - não sabemos a loja de ingressos do mandante.
export function enderecoDoIngresso(jogo, ingressos, agora = new Date()) {
  if (jogo.disputado || agora.getTime() >= new Date(jogo.data).getTime()) return null;
  const url = ingressos?.times?.[jogo.mandante]?.url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

// Quantos milissegundos faltam para o próximo início entre estes jogos (ou null se nenhum vai
// começar). A página usa isso para redesenhar os cartões e tirar o botão na hora certa.
export function msAteOProximoInicio(jogos, agora = new Date()) {
  const futuros = jogos
    .filter((j) => !j.disputado)
    .map((j) => new Date(j.data).getTime() - agora.getTime())
    .filter((ms) => ms > 0);
  return futuros.length ? Math.min(...futuros) : null;
}
