// libertadores-2026.js
// O formato da Copa Libertadores (CONMEBOL Libertadores) 2026, montado com as peças do motor dos
// estaduais (site/js/estaduais/motor.js): fase de grupos + mata-mata. As regras são as mesmas da
// Sul-Americana (o Manual de Clubes da CONMEBOL de 2026), sem os playoffs.
// Fontes: jogos da ESPN; regras do Manual de Clubes 2026, como descritas pela CONMEBOL e pela
// imprensa; o sorteio das oitavas (29/05/2026), tirado dos próprios jogos.
//
// As três fases preliminares (fevereiro e março) ficam de fora: aqui o campeonato começa na fase
// de grupos, com os 32 times.

const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// As oitavas sorteadas pela CONMEBOL em 29/05/2026 (depois da fase de grupos): cada confronto é
// [grupo do 1º colocado, grupo do 2º colocado], na ordem da chave: os vencedores das oitavas 1 e 2
// se cruzam nas quartas, e assim por diante; nas semifinais, quartas 1 x quartas 2 e quartas 3 x
// quartas 4. Times do mesmo grupo podiam se enfrentar.
const OITAVAS_SORTEADAS = [["C", "C"], ["B", "E"], ["F", "F"], ["G", "G"], ["D", "A"], ["E", "H"], ["H", "B"], ["A", "D"]];

export const LIBERTADORES_2026 = {
  id: "libertadores-2026",
  nome: "Copa Libertadores 2026",
  curto: "Libertadores",
  aba: "libertadores",
  pasta: "data/copas/libertadores-2026",
  // Faixa lateral de cada posição no grupo: 1º e 2º vão às oitavas; o 3º cai para a Sul-Americana.
  zona: (posicao) => (posicao <= 2 ? "avanco" : posicao === 3 ? "sulamericana" : "neutra"),
  desempateConmebol: true,

  resultados: [
    { campo: "oitavas", rotulo: "Oitavas", classe: "avanco" },
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
  ],
  totais: { oitavas: 16, quartas: 8, semifinal: 4, final: 2, titulo: 1 },

  regras: [
    "Fase de grupos: 32 times em 8 grupos de 4, todos contra todos em ida e volta (6 jogos cada).",
    "Desempate nos grupos (regra nova de 2026): primeiro os jogos entre os empatados (pontos, saldo e gols); depois saldo e gols no grupo todo; por fim, cartões e sorteio (cartões não dá para prever, então o site sorteia).",
    "O 1º e o 2º de cada grupo vão às oitavas. O 3º cai para os playoffs da Sul-Americana. O 4º está eliminado.",
    "Oitavas: um líder de grupo contra um segundo colocado, por sorteio (times do mesmo grupo podem se enfrentar). O sorteio já define o caminho até a final. Antes do sorteio, o site sorteia as chaves em cada simulação.",
    "Mata-mata (oitavas, quartas e semifinais): ida e volta, sem gol fora de casa. Empate no placar somado: pênaltis, sem prorrogação.",
    "Quem joga a volta em casa: o time com a melhor \"numeração\" da CONMEBOL, feita ao fim da fase de grupos: 1º a 8º, os líderes de grupo (por pontos, saldo e gols); 9º a 16º, os segundos colocados.",
    "Final: jogo único em campo neutro (em 2026, no Estádio Centenário, em Montevidéu). Empate: prorrogação e, se continuar, pênaltis.",
    "Fora das contas: as três fases preliminares (fevereiro e março), que só decidiram quem entrava nos grupos.",
  ],

  simular(sim, camp) {
    sim.jogarCalendario("primeira-fase");
    const primeiros = {};
    const segundos = {};
    for (const g of GRUPOS) {
      const tabela = sim.classificarConmebol(camp.grupos[g], "primeira-fase");
      primeiros[g] = tabela[0];
      segundos[g] = tabela[1];
    }

    // A "numeração" da CONMEBOL: quem tem o número menor joga a volta em casa.
    const numeracao = new Map();
    sim.ordenarEntreGrupos(Object.values(primeiros), "primeira-fase").forEach((t, i) => numeracao.set(t, 1 + i));
    sim.ordenarEntreGrupos(Object.values(segundos), "primeira-fase").forEach((t, i) => numeracao.set(t, 9 + i));
    const idaEVolta = (fase, a, b) =>
      sim.confronto(fase, a, b, { casaDaVolta: numeracao.get(a) < numeracao.get(b) ? a : b });

    // Antes do sorteio de verdade (logo depois da fase de grupos), cada simulação faz o seu.
    let chave = OITAVAS_SORTEADAS;
    if (!camp.temJogosReais("oitavas")) {
      const ordem = sim.sortear(GRUPOS);
      chave = GRUPOS.map((g, i) => [g, ordem[i]]);
    }
    const oitavas = chave.map(([g1, g2]) => idaEVolta("oitavas", primeiros[g1], segundos[g2]).vencedor);
    const quartas = [0, 2, 4, 6].map((i) => idaEVolta("quartas", oitavas[i], oitavas[i + 1]).vencedor);
    const semifinal = [0, 2].map((i) => idaEVolta("semifinal", quartas[i], quartas[i + 1]).vencedor);
    const final = sim.confronto("final", semifinal[0], semifinal[1], { pernas: 1, neutro: true, prorrogacao: true });

    return {
      oitavas: [...Object.values(primeiros), ...Object.values(segundos)],
      quartas: oitavas,
      semifinal: quartas,
      final: semifinal,
      titulo: [final.vencedor],
    };
  },
};
