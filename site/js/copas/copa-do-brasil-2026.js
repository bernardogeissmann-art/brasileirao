// copa-do-brasil-2026.js
// O formato da Copa do Brasil 2026, montado com as peças do motor dos estaduais
// (site/js/estaduais/motor.js). Aqui não há fase de grupos: é mata-mata do começo ao fim.
// Fontes: jogos da ESPN; regras do regulamento da CBF de 2026, como descritas pela imprensa
// (final em jogo único em Brasília, anunciada em 10/09/2026; empate decidido nos pênaltis).
//
// As quatro primeiras fases (jogos únicos de fevereiro e março, com mais de 100 clubes) ficam de
// fora: aqui o campeonato começa na 5ª fase, com 32 times.

// As fases de ida e volta, na ordem, com o campo das chances de quem passa por cada uma.
const FASES = [
  ["quinta-fase", "oitavas"],
  ["oitavas", "quartas"],
  ["quartas", "semifinal"],
  ["semifinal", "final"],
];

export const COPA_DO_BRASIL_2026 = {
  id: "copa-do-brasil-2026",
  nome: "Copa do Brasil 2026",
  curto: "Copa do Brasil",
  aba: "copa-do-brasil",
  pasta: "data/copas/copa-do-brasil-2026",
  zona: () => "neutra",
  // Sem grupos: a tabela de cada momento mostra a campanha de todos os times, sem posição.
  gruposDeFora: { CDB: "Os 32 times da 5ª fase" },

  resultados: [
    { campo: "oitavas", rotulo: "Oitavas", classe: "avanco" },
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
  ],
  totais: { oitavas: 16, quartas: 8, semifinal: 4, final: 2, titulo: 1 },

  regras: [
    "Da 5ª fase às semifinais: confrontos de ida e volta, sem gol fora de casa. Empate no placar somado: pênaltis, sem prorrogação.",
    "Os confrontos e a ordem dos mandos são sorteados pela CBF antes de cada fase. Antes do sorteio de uma fase, o site sorteia os confrontos em cada simulação.",
    "Final: pela primeira vez, jogo único, no Estádio Mané Garrincha, em Brasília (6 de dezembro de 2026). Empate: pênaltis.",
    "O campeão ganha vaga na fase de grupos da Libertadores 2027.",
    "Fora das contas: as quatro primeiras fases (jogos únicos de fevereiro e março), que só decidiram quem chegava à 5ª fase.",
  ],

  simular(sim, camp) {
    const resultado = {};
    let vivos = null;
    for (const [fase, campo] of FASES) {
      // Os confrontos já sorteados (os do arquivo de jogos) valem a partir do momento em que a
      // fase começa; a 5ª fase já estava sorteada antes do 1º jogo. Antes disso, um sorteio por simulação.
      let pares;
      if (fase === "quinta-fase" || camp.temJogosReais(fase)) {
        pares = camp.confrontosDaFase(fase);
      } else {
        const ordem = sim.sortear(vivos);
        pares = [];
        for (let i = 0; i < ordem.length; i += 2) pares.push([ordem[i], ordem[i + 1]]);
      }
      // [a, b]: "a" joga a ida em casa e "b", a volta.
      vivos = pares.map(([a, b]) => sim.confronto(fase, a, b, { casaDaVolta: b }).vencedor);
      resultado[campo] = vivos;
    }
    // Final em jogo único, em campo neutro: empate vai direto para os pênaltis.
    const final = sim.confronto("final", vivos[0], vivos[1], { pernas: 1, neutro: true });
    resultado.titulo = [final.vencedor];
    return resultado;
  },
};
