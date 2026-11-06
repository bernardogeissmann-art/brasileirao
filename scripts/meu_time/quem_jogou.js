// quem_jogou.js
// Descobre quais times precisam de um texto "Situação atual" novo, sem gastar nada: só olha
// o horário dos jogos (data/jogos.json) e a hora do último texto de cada time (data/meu-time.json).
//
// Regra: o texto de um time é reescrito uns 30 minutos depois do fim do jogo dele. Um jogo
// leva uns 110 minutos do apito inicial ao final (45 + intervalo + 45 + acréscimos); então,
// a partir de 140 minutos depois do horário marcado, se o texto do time for de antes do
// jogo, ele precisa ser reescrito.
//
// Usado pelo GitHub Actions (rotina "Depois dos jogos"): se a lista vier vazia, nada é feito
// (nem a IA é chamada). Também dá para rodar no seu computador, para ver quem jogou:
//     node scripts/meu_time/quem_jogou.js

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MINUTO = 60 * 1000;
export const DEPOIS_DO_INICIO = 140 * MINUTO;   // ~110 minutos de jogo + 30 de folga
const JANELA = 24 * 60 * MINUTO;                // jogos de até 24 horas atrás (os mais velhos ficam para a madrugada)

// Os times cujo último jogo terminou há pelo menos ~30 minutos e cujo texto é de antes desse jogo.
export function timesQuePrecisamDeTexto(jogos, meuTime, agora = new Date()) {
  const precisam = new Set();
  for (const jogo of jogos) {
    if (jogo.status_fonte === "POSTPONED") continue;
    const inicio = new Date(jogo.data).getTime();
    const desdeOInicio = agora.getTime() - inicio;
    if (desdeOInicio < DEPOIS_DO_INICIO || desdeOInicio > JANELA) continue;
    for (const id of [jogo.mandante, jogo.visitante]) {
      const textoEm = meuTime.times?.[id]?.texto_em;
      if (!textoEm || new Date(textoEm).getTime() < inicio) precisam.add(id);
    }
  }
  return [...precisam].sort();
}

// Rodando direto (e não importado por outro arquivo): mostra a lista e avisa o GitHub.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = new URL("../../", import.meta.url);
  const jogos = JSON.parse(readFileSync(new URL("data/jogos.json", raiz), "utf-8")).jogos;
  const arquivo = new URL("data/meu-time.json", raiz);
  const meuTime = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf-8")) : { times: {} };
  const lista = timesQuePrecisamDeTexto(jogos, meuTime);
  console.log(lista.length ? `Precisam de texto novo: ${lista.join(", ")}` : "Nenhum time precisa de texto novo agora.");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `times=${lista.join(",")}\n`);
}
