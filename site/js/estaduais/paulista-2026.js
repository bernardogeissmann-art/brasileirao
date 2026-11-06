// paulista-2026.js
// O formato do Campeonato Paulista Série A1 (Paulistão) 2026, montado com as peças do motor.js.
// Fontes: jogos da ESPN, regras do REC 2026 descritas na Wikipédia e na imprensa, e o próprio
// andamento do campeonato (mandos e chaveamentos reais).
// Ponto não confirmado no REC: o mando das semifinais (jogo único) foi dado ao time mais bem
// colocado na fase de liga, que foi o que aconteceu nos dois jogos de 2026.

export const PAULISTA_2026 = {
  id: "paulista-2026",
  nome: "Campeonato Paulista 2026",
  curto: "Paulistão",
  aba: "paulista",
  // Faixa lateral de cada posição: 1º a 8º vão às quartas; 15º e 16º caem; o meio fica sem cor.
  zona: (posicao) => (posicao <= 8 ? "avanco" : posicao >= 15 ? "rebaixamento" : "neutra"),
  // A 1ª fase é uma tabela única (não há grupos A e B).
  tituloGrupo: () => "Fase de liga",

  resultados: [
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
    { campo: "rebaixamento", rotulo: "Rebaixamento", classe: "rebaixamento" },
  ],
  totais: { quartas: 8, semifinal: 4, final: 2, titulo: 1, rebaixamento: 2 },

  regras: [
    "Fase de liga: os 16 times numa tabela única. Cada um faz 8 jogos (contra os 3 rivais do seu pote e mais 5 de outros potes), em turno único.",
    "Desempate: vitórias, saldo de gols, gols marcados, cartões e sorteio (cartões não dá para prever, então o site sorteia).",
    "Quartas de final (jogo único, na casa do mais bem colocado): 1º × 8º, 4º × 5º, 2º × 7º e 3º × 6º. Empate: pênaltis.",
    "Semifinais (jogo único): o vencedor de 1º × 8º enfrenta o de 4º × 5º, e o de 2º × 7º enfrenta o de 3º × 6º. Joga em casa quem ficou mais bem colocado na fase de liga. Empate: pênaltis.",
    "Final (ida e volta): a melhor campanha decide em casa. Empate no agregado: pênaltis.",
    "Rebaixamento: os dois últimos da fase de liga caem para a Série A2.",
  ],

  simular(sim, camp) {
    sim.jogarCalendario("primeira-fase");
    const L = sim.classificar(camp.grupos.A, "primeira-fase");
    const posicao = (time) => L.indexOf(time);   // 0 = 1º colocado

    // Quartas: jogo único na casa do mais bem colocado.
    const quartas = [[0, 7], [3, 4], [1, 6], [2, 5]].map(([a, b]) =>
      sim.confronto("quartas", L[a], L[b], { pernas: 1, mandante: L[a] }));

    // Semifinais: chave fixa; joga em casa quem ficou mais bem colocado na fase de liga.
    const semifinal = (x, y) =>
      sim.confronto("semifinal", x, y, { pernas: 1, mandante: posicao(x) < posicao(y) ? x : y });
    const s1 = semifinal(quartas[0].vencedor, quartas[1].vencedor);
    const s2 = semifinal(quartas[2].vencedor, quartas[3].vencedor);
    const final = sim.confronto("final", s1.vencedor, s2.vencedor);

    return {
      quartas: L.slice(0, 8),
      semifinal: quartas.map((q) => q.vencedor),
      final: [s1.vencedor, s2.vencedor],
      titulo: [final.vencedor],
      rebaixamento: L.slice(14),
    };
  },
};
