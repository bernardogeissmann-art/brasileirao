// atualizar_noticias.js
// Busca as notícias recentes de cada time (Globo Esporte, UOL Esporte e ESPN) e guarda em
// data/meu-time.json. Roda toda madrugada. As notícias novas se juntam às que já estavam lá:
// se num dia sair só uma notícia nova, ela entra no lugar da mais velha (ficam as 6 mais
// recentes dos últimos 10 dias). O texto "Situação atual" não muda aqui.
// Não usa IA (não gasta nada).
//
// Como rodar (na pasta do projeto):
//     node scripts/meu_time/atualizar_noticias.js

import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buscarNoticias, juntarNoticias } from "./noticias.js";
import { lerMeuTime, salvarMeuTime, RAIZ } from "./contexto.js";

export async function atualizarNoticias(ids, conteudo = lerMeuTime()) {
  for (const id of ids) {
    const antigas = conteudo.times[id]?.noticias ?? [];
    const novas = await buscarNoticias(id);
    const juntas = juntarNoticias(antigas, novas);
    const quantasNovas = juntas.filter((n) => !antigas.some((a) => a.link === n.link)).length;
    conteudo.times[id] = { ...conteudo.times[id], noticias: juntas, noticias_em: new Date().toISOString() };
    console.log(`${id}: ${juntas.length} notícias (${quantasNovas} novas)`);
  }
  salvarMeuTime(conteudo);
}

// Rodando direto (e não importado por outro arquivo): todos os times do Brasileirão.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const times = JSON.parse(readFileSync(new URL("data/serie-a/jogos.json", RAIZ), "utf-8")).times;
  await atualizarNoticias(Object.keys(times));
}
