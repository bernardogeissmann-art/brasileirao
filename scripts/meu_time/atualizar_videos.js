// atualizar_videos.js
// Guarda, para cada time, os vídeos mais recentes de cada canal do YouTube dele (os canais
// ficam em data/canais-youtube.json). A página Meu Time mostra essa lista guardada, que só
// muda 20 horas depois de cada jogo do time (quem decide quando é o quem_jogou.js).
// Os vídeos ficam em data/meu-time.json, em times.<time>.videos (e a hora em videos_em).
//
// Os vídeos vêm da API oficial do YouTube (YouTube Data API v3), que pede uma chave:
// YOUTUBE_API_KEY, no arquivo .env (no seu computador) ou nos secrets do GitHub. Cada canal
// gasta 1 ponto da cota grátis de 10.000 por dia. (Os feeds RSS do YouTube não podem ser
// usados: o robots.txt deles proíbe.)
//
// Como rodar (na pasta do projeto):
//     node scripts/meu_time/atualizar_videos.js --times palmeiras,bahia
//     node scripts/meu_time/atualizar_videos.js                 (todos os times)

import { readFileSync } from "node:fs";
import { lerMeuTime, salvarMeuTime, RAIZ } from "./contexto.js";
import { listaDoYouTube, CODIGO_VIDEO } from "../../site/js/videos.js";

// No seu computador, a chave fica no arquivo .env; no GitHub, vem dos "secrets".
try { process.loadEnvFile(new URL(".env", RAIZ)); } catch { /* sem .env */ }

const QUANTOS = 10;   // vídeos guardados por canal
const API = "https://www.googleapis.com/youtube/v3/playlistItems";

// Os códigos dos vídeos mais recentes de uma lista do YouTube (do mais novo para o mais velho).
// A chave vai no cabeçalho do pedido (e não no endereço), para não aparecer em nenhum registro.
async function videosDaLista(lista, chave) {
  const endereco = `${API}?part=contentDetails&maxResults=${QUANTOS}&playlistId=${lista}`;
  const resposta = await fetch(endereco, { headers: { "X-Goog-Api-Key": chave }, signal: AbortSignal.timeout(15000) });
  if (resposta.status === 404 && lista.startsWith("UULF")) {
    // Canal sem nenhum vídeo comum (só Shorts ou lives): usa a lista de tudo o que ele publicou.
    return videosDaLista(`UU${lista.slice(4)}`, chave);
  }
  if (!resposta.ok) {
    const erro = new Error(`o YouTube respondeu com erro ${resposta.status} para a lista ${lista}`);
    erro.status = resposta.status;
    throw erro;
  }
  const dados = await resposta.json();
  return (dados.items ?? []).map((item) => item.contentDetails?.videoId).filter((v) => CODIGO_VIDEO.test(v ?? ""));
}

// Erros 400, 401 e 403 são da chave (errada, sem permissão ou sem cota): tenta de novo depois.
// Outros erros (ex.: canal que não existe mais) não adiantam repetir.
const erroDaChave = (erro) => [400, 401, 403].includes(erro.status);

async function main() {
  const chave = process.env.YOUTUBE_API_KEY?.trim();
  if (!chave) {
    console.log("Sem a chave YOUTUBE_API_KEY: nada a fazer (a página segue a lista do próprio YouTube).");
    return;
  }
  const canais = JSON.parse(readFileSync(new URL("data/canais-youtube.json", RAIZ), "utf-8"));
  const pedido = process.argv.indexOf("--times");
  const ids = pedido >= 0 ? (process.argv[pedido + 1] ?? "").split(",").filter(Boolean) : Object.keys(canais.times);

  const conteudo = lerMeuTime();
  conteudo.times ??= {};
  let certos = 0;
  let erros = 0;
  for (const id of ids) {
    const listas = (canais.times[id] ?? []).map(listaDoYouTube).filter(Boolean);
    if (listas.length === 0) continue;
    const time = (conteudo.times[id] ??= {});
    const antes = time.videos ?? {};
    const novos = {};
    let deste = 0;
    let tentarDeNovo = false;
    for (const lista of listas) {
      try {
        novos[lista] = await videosDaLista(lista, chave);
        deste++;
      } catch (erro) {
        console.warn(`${id}: ${erro.message}`);
        erros++;
        if (erroDaChave(erro) || !erro.status) tentarDeNovo = true;   // chave ou internet: vale repetir
        if (antes[lista]) novos[lista] = antes[lista];   // se der erro, fica a lista anterior
      }
    }
    time.videos = novos;   // canais que saíram do canais-youtube.json saem daqui também
    // A hora só muda se não houver motivo para tentar de novo; senão, a próxima rodada repete.
    if (!tentarDeNovo) time.videos_em = new Date().toISOString();
    certos += deste;
    console.log(`${id}: vídeos de ${deste} de ${listas.length} canais.`);
  }
  salvarMeuTime(conteudo);
  // Nenhum canal deu certo: provavelmente a chave foi recusada. Avisa com erro.
  if (certos === 0 && erros > 0) {
    console.error("Nenhum canal respondeu. Confira a chave YOUTUBE_API_KEY (e se a YouTube Data API v3 está ativada).");
    process.exitCode = 1;
  }
}

await main();
