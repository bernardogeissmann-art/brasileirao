// reta-final.js
// A lógica do painel "Reta final" da Série B (só contas, nada de HTML: o visual fica em
// componentes-reta-final.js). A partir do resultado das simulações, decide:
//   1) as disputas em aberto (título, acesso direto, vaga no playoff, rebaixamento):
//      quem ainda briga por cada coisa e a chance de cada um se vencer, empatar ou perder
//      o último jogo;
//   2) o playoff: quem pode ocupar cada vaga (3º, 4º, 5º e 6º) e os confrontos mais prováveis.

// Abaixo disso, o time não aparece numa disputa (é o mesmo limite do "<1%" do site).
const MINIMO = 0.01;

// As quatro disputas, com as posições que valem cada uma (lidas da ficha do campeonato).
//   "ruim: true" quer dizer que o time quer fugir daquilo (o rebaixamento).
function listaDeDisputas(faixas) {
  const [, ultimaDoPlayoff] = faixas.playoff;
  return [
    { id: "titulo", titulo: "Título", faixa: faixas.titulo, cor: "titulo", detalhe: "1º lugar" },
    { id: "acesso_direto", titulo: "Acesso direto", faixa: faixas.acesso_direto, cor: "libertadores", detalhe: "1º e 2º sobem direto" },
    { id: "g6", titulo: "Vaga no playoff", faixa: [1, ultimaDoPlayoff], cor: "sulamericana", detalhe: `terminar entre os ${ultimaDoPlayoff} primeiros` },
    { id: "rebaixamento", titulo: "Rebaixamento", faixa: faixas.rebaixamento, cor: "rebaixamento", detalhe: `do ${faixas.rebaixamento[0]}º ao ${faixas.rebaixamento[1]}º caem`, ruim: true },
  ];
}

// Soma as chances das posições "de" até "ate" (posicoes[0] é o 1º lugar).
function chanceNaFaixa(posicoes, [de, ate]) {
  return posicoes.slice(de - 1, ate).reduce((soma, p) => soma + p, 0);
}

// As disputas em aberto.
//   resultado: o que simular() devolveu; tabela: a tabela de agora (tabelaAtual).
// Cada disputa traz "garantidos" (100% nas simulações) e "times" (os que ainda brigam),
// na ordem da tabela. Disputas sem ninguém brigando ficam de fora.
export function disputasEmAberto(resultado, tabela, faixas) {
  const chancesPorTime = new Map(resultado.times.map((t) => [t.id, t]));
  return listaDeDisputas(faixas).map((disputa) => {
    const garantidos = [];
    const times = [];
    for (const linha of tabela) {
      const chances = chancesPorTime.get(linha.id);
      const chance = chanceNaFaixa(chances.posicoes, disputa.faixa);
      if (chance === 1) garantidos.push(linha.id);
      else if (chance >= MINIMO) times.push({ ...linha, chance, ultimoJogo: seUltimoJogo(chances.ultimoJogo, disputa.faixa) });
    }
    return { ...disputa, garantidos, times };
  }).filter((disputa) => disputa.times.length > 0);
}

// A chance da disputa para cada resultado do último jogo do time. Um resultado que não saiu
// em nenhuma simulação (por exemplo, porque o usuário deu um palpite nesse jogo) vira null.
function seUltimoJogo(ultimoJogo, faixa) {
  if (!ultimoJogo) return null;
  const chance = (r) => (r.vezes === 0 ? null : chanceNaFaixa(r.posicoes, faixa));
  return {
    id: ultimoJogo.id,
    adversario: ultimoJogo.adversario,
    emCasa: ultimoJogo.emCasa,
    vitoria: chance(ultimoJogo.vitoria),
    empate: chance(ultimoJogo.empate),
    derrota: chance(ultimoJogo.derrota),
  };
}

// O playoff: para cada confronto (ex.: 3º x 6º), quem pode ficar em cada uma das duas
// posições e as duplas mais prováveis, com a chance de cada uma e de quem passa.
//   jogosDoPlayoff: os jogos do playoff já marcados (jogos.json, campo "playoff").
export function quadroDoPlayoff(resultado, jogosDoPlayoff = []) {
  const candidatos = (posicao) => resultado.times
    .map((t) => ({ id: t.id, chance: t.posicoes[posicao - 1] }))
    .filter((t) => t.chance >= MINIMO)
    .sort((a, b) => b.chance - a.chance)
    .slice(0, 4);
  return (resultado.confrontosPlayoff ?? []).map(({ melhor, pior, duplas }) => ({
    melhor, pior,
    candidatosMelhor: candidatos(melhor),
    candidatosPior: candidatos(pior),
    duplas: duplas.filter((d) => d.chance >= MINIMO).slice(0, 3).map((d) => ({
      ...d,
      // Ida na casa do pior colocado, volta na casa do melhor (se a ESPN já tiver marcado).
      jogos: jogosDoPlayoff
        .filter((j) => [j.mandante, j.visitante].sort().join() === [d.melhor, d.pior].sort().join())
        .sort((a, b) => (a.data < b.data ? -1 : 1)),
    })),
  }));
}

// Quantas rodadas ainda têm jogo por disputar (para decidir se o painel aparece).
export function rodadasQueFaltam(jogos) {
  return new Set(jogos.filter((j) => !j.disputado).map((j) => j.rodada)).size;
}

// O dia e a hora da última rodada, para o título do painel: o horário com mais jogos dela
// (um jogo adiado da rodada anterior pode ter ficado com o mesmo número de rodada).
export function ultimaRodada(jogos) {
  const faltam = jogos.filter((j) => !j.disputado);
  if (faltam.length === 0) return null;
  const numero = Math.max(...faltam.map((j) => j.rodada));
  const porHorario = new Map();   // horário -> quantos jogos
  for (const j of faltam.filter((j) => j.rodada === numero)) porHorario.set(j.data, (porHorario.get(j.data) ?? 0) + 1);
  const [data, jogosNoHorario] = [...porHorario].sort((a, b) => b[1] - a[1])[0];
  return { numero, data, jogosNoHorario };
}
