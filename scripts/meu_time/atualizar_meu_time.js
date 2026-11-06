// atualizar_meu_time.js
// Atualiza TUDO da página Meu Time de uma vez, para os 20 times: as notícias e o texto
// "Situação atual". Serve para rodar na mão (ex.: na primeira vez, ou depois de mudar algo).
//
// No dia a dia, quem atualiza é o GitHub, em momentos escolhidos para gastar o mínimo:
//   - notícias: toda madrugada (atualizar_noticias.js, sem IA);
//   - texto: só para os times que jogaram, uns 30 minutos depois do jogo (atualizar_textos.js,
//     com a IA mais leve), e de novo de madrugada para quem tiver ficado para trás.
//
// Como rodar (na pasta do projeto, depois de baixar os jogos e estimar o modelo):
//     node scripts/meu_time/atualizar_meu_time.js

import { carregarContexto, lerMeuTime } from "./contexto.js";
import { atualizarNoticias } from "./atualizar_noticias.js";
import { atualizarTextos } from "./atualizar_textos.js";

const contexto = carregarContexto();
const ids = Object.keys(contexto.times);
const conteudo = lerMeuTime();
await atualizarNoticias(ids, conteudo);           // primeiro as notícias (o texto pode citar uma delas)
await atualizarTextos(ids, contexto, conteudo);
console.log("Salvo: data/meu-time.json");
