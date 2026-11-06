// quem_jogou.js
// Descobre quais times precisam de um texto "Situação atual" novo e quais precisam de vídeos
// novos, sem gastar nada: só olha o horário dos jogos (data/jogos.json) e a hora do último
// texto e dos últimos vídeos de cada time (data/meu-time.json).
//
// Regra: o texto de um time (e a tabela do site) é atualizado uns 120 minutos depois do início do
// jogo: ele leva uns 110 minutos do apito inicial ao final (45 + intervalo + 45 + acréscimos). Então,
// a partir de 120 minutos depois do horário marcado, se o texto do time for de antes do
// jogo, ele precisa ser reescrito.
//
// Vídeos: a lista de vídeos de um time só muda 20 horas depois do início de cada jogo dele
// (tempo para os canais publicarem o pós-jogo, contando com o atraso das rotinas do GitHub).
//
// Usado pelo GitHub Actions (rotina "Depois dos jogos"): se a lista vier vazia, nada é feito
// (nem a IA é chamada). Também dá para rodar no seu computador, para ver quem jogou:
//     node scripts/meu_time/quem_jogou.js
// No GitHub, --sem-textos ou --sem-videos zeram uma das listas (quando falta a chave dela).

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listaDoYouTube } from "../../site/js/videos.js";

const MINUTO = 60 * 1000;
export const DEPOIS_DO_INICIO = 120 * MINUTO;   // ~110 minutos de jogo + 10 de folga
const JANELA = 24 * 60 * MINUTO;                // jogos de até 24 horas atrás (os mais velhos ficam para a madrugada)
export const VIDEOS_DEPOIS_DO_INICIO = 20 * 60 * MINUTO;   // 20 horas

// Os times cujo último jogo começou há pelo menos 120 minutos e cujo texto é de antes desse jogo.
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

// Os times com canal de vídeos cujo último jogo começou há pelo menos 20 horas e cuja lista de
// vídeos guardada é de antes disso (ou ainda não existe).
export function timesQuePrecisamDeVideos(jogos, meuTime, canais, agora = new Date()) {
  const precisam = [];
  for (const [id, entradas] of Object.entries(canais?.times ?? {})) {
    if (!entradas.some(listaDoYouTube)) continue;   // só vídeo avulso: não há lista para guardar
    // A hora em que a lista deste time deveria ter mudado pela última vez: 20 horas depois do
    // início do último jogo que já passou desse ponto.
    const marcos = jogos
      .filter((j) => (j.mandante === id || j.visitante === id) && j.status_fonte !== "POSTPONED")
      .map((j) => new Date(j.data).getTime() + VIDEOS_DEPOIS_DO_INICIO)
      .filter((marco) => marco <= agora.getTime());
    const marco = marcos.length ? Math.max(...marcos) : 0;
    const videosEm = meuTime.times?.[id]?.videos_em;
    if (!videosEm || new Date(videosEm).getTime() < marco) precisam.push(id);
  }
  return precisam.sort();
}

// Rodando direto (e não importado por outro arquivo): mostra a lista e avisa o GitHub.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = new URL("../../", import.meta.url);
  const jogos = JSON.parse(readFileSync(new URL("data/jogos.json", raiz), "utf-8")).jogos;
  const arquivo = new URL("data/meu-time.json", raiz);
  const meuTime = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, "utf-8")) : { times: {} };
  const canais = JSON.parse(readFileSync(new URL("data/canais-youtube.json", raiz), "utf-8"));
  const textos = process.argv.includes("--sem-textos") ? [] : timesQuePrecisamDeTexto(jogos, meuTime);
  const videos = process.argv.includes("--sem-videos") ? [] : timesQuePrecisamDeVideos(jogos, meuTime, canais);
  console.log(textos.length ? `Precisam de texto novo: ${textos.join(", ")}` : "Nenhum time precisa de texto novo agora.");
  console.log(videos.length ? `Precisam de vídeos novos: ${videos.join(", ")}` : "Nenhum time precisa de vídeos novos agora.");
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `times=${textos.join(",")}\nvideos=${videos.join(",")}\n`);
  }
}
