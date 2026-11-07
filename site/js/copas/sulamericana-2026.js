// sulamericana-2026.js
// O formato da Copa Sul-Americana (CONMEBOL Sudamericana) 2026, montado com as peças do
// motor dos estaduais (site/js/estaduais/motor.js): fase de grupos + mata-mata.
// Fontes: jogos da ESPN; regras do Manual de Clubes da CONMEBOL Sudamericana 2026, como
// descritas pela CONMEBOL, pela AFA (sorteio de 29/05/2026) e pela imprensa (Infobae, 20/03/2026).
//
// A "primeira fase" (jogos únicos de março entre clubes do mesmo país) fica de fora: aqui o
// campeonato começa na fase de grupos, já com os 32 times.

// Os 8 terceiros colocados dos grupos da Libertadores 2026, que caem para os playoffs da
// Sul-Americana, na ordem da campanha deles lá (pontos, saldo e gols, calculados com os jogos
// da ESPN). Eles recebem os números 17 a 24 na "numeração" da CONMEBOL (ver abaixo).
const DA_LIBERTADORES = ["ucv", "lanus", "santa-fe", "nacional", "boca-juniors", "independiente-medellin",
  "sporting-cristal", "bolivar"];

const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// As chaves sorteadas pela CONMEBOL em 29/05/2026 (depois da fase de grupos).
//   playoffs: o 2º colocado de cada grupo enfrenta este time da Libertadores
//   oitavas:  [grupo do 1º colocado, grupo do 2º colocado cujo playoff dá o adversário],
//             na ordem da chave: os vencedores das oitavas 1 e 2 se cruzam nas quartas, e assim
//             por diante; nas semifinais, quartas 1 x quartas 2 e quartas 3 x quartas 4.
const CHAVES_SORTEADAS = {
  playoffs: { A: "nacional", B: "lanus", C: "boca-juniors", D: "ucv", E: "santa-fe", F: "bolivar",
    G: "independiente-medellin", H: "sporting-cristal" },
  oitavas: [["H", "E"], ["G", "G"], ["D", "C"], ["C", "F"], ["A", "D"], ["B", "H"], ["E", "B"], ["F", "A"]],
};

export const SULAMERICANA_2026 = {
  id: "sulamericana-2026",
  nome: "Copa Sul-Americana 2026",
  curto: "Sul-Americana",
  aba: "sulamericana",
  // Onde ficam os dados (os estaduais ficam em data/estaduais/).
  pasta: "data/copas/sulamericana-2026",
  // Faixa lateral de cada posição no grupo: 1º vai direto às oitavas; 2º vai aos playoffs.
  zona: (posicao) => (posicao === 1 ? "avanco" : posicao === 2 ? "sulamericana" : "neutra"),
  // Tabela dos grupos com o desempate da CONMEBOL (primeiro os jogos entre os empatados).
  desempateConmebol: true,
  // Times que não jogaram a fase de grupos: aparecem num bloco à parte, com a campanha na copa.
  gruposDeFora: { LIB: "Vindos da Libertadores" },

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
    "O 1º de cada grupo vai direto às oitavas. O 2º vai aos playoffs, contra um dos 8 terceiros colocados dos grupos da Libertadores (por sorteio). Os 3º e 4º estão eliminados.",
    "Mata-mata (playoffs, oitavas, quartas e semifinais): ida e volta, sem gol fora de casa. Empate no placar somado: pênaltis, sem prorrogação.",
    "Quem joga a volta em casa: o time com a melhor \"numeração\" da CONMEBOL, feita ao fim da fase de grupos: 1º a 8º, os líderes de grupo (por pontos, saldo e gols); 9º a 16º, os segundos colocados; 17º a 24º, os que vieram da Libertadores.",
    "As oitavas (líderes de grupo × vencedores dos playoffs) foram sorteadas junto com os playoffs, e o sorteio já definiu o caminho até a final. Antes do sorteio, o site sorteia as chaves em cada simulação.",
    "Final: jogo único em campo neutro (em 2026, no Estádio Metropolitano, em Barranquilla, na Colômbia). Empate: prorrogação e, se continuar, pênaltis.",
    "O campeão ganha vaga na fase de grupos da Libertadores 2027.",
    "Fora das contas: a primeira fase (jogos únicos de março entre clubes do mesmo país, que só decidiram quem entrava nos grupos).",
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
    DA_LIBERTADORES.forEach((id, i) => numeracao.set(camp.numero.get(id), 17 + i));
    const idaEVolta = (fase, a, b) =>
      sim.confronto(fase, a, b, { casaDaVolta: numeracao.get(a) < numeracao.get(b) ? a : b });

    // Antes do sorteio de verdade (que veio logo depois da fase de grupos), cada simulação
    // faz o seu próprio sorteio. Depois dele, valem as chaves sorteadas.
    const jaSorteado = camp.temJogosReais("playoffs");
    const timesDaLibertadores = DA_LIBERTADORES.map((id) => camp.numero.get(id));
    const rivaisDosPlayoffs = jaSorteado
      ? GRUPOS.map((g) => camp.numero.get(CHAVES_SORTEADAS.playoffs[g]))
      : sim.sortear(timesDaLibertadores);
    const venceuPlayoff = {};
    GRUPOS.forEach((g, i) => { venceuPlayoff[g] = idaEVolta("playoffs", segundos[g], rivaisDosPlayoffs[i]).vencedor; });

    let chaveOitavas;
    if (jaSorteado) {
      chaveOitavas = CHAVES_SORTEADAS.oitavas;
    } else {
      const ordem = sim.sortear(GRUPOS);
      chaveOitavas = GRUPOS.map((g, i) => [g, ordem[i]]);
    }
    const oitavas = chaveOitavas.map(([g1, g2]) => idaEVolta("oitavas", primeiros[g1], venceuPlayoff[g2]).vencedor);
    const quartas = [0, 2, 4, 6].map((i) => idaEVolta("quartas", oitavas[i], oitavas[i + 1]).vencedor);
    const semifinal = [0, 2].map((i) => idaEVolta("semifinal", quartas[i], quartas[i + 1]).vencedor);
    const final = sim.confronto("final", semifinal[0], semifinal[1], { pernas: 1, neutro: true, prorrogacao: true });

    return {
      oitavas: [...Object.values(primeiros), ...Object.values(venceuPlayoff)],
      quartas: oitavas,
      semifinal: quartas,
      final: semifinal,
      titulo: [final.vencedor],
    };
  },
};
