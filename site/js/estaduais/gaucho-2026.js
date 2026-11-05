// gaucho-2026.js
// O formato do Campeonato Gaúcho Série A (Gauchão) 2026, montado com as peças do motor.js.
// Fontes: jogos da ESPN, regras do REC 2026 resumidas pela FGF e pela Wikipédia, e o próprio
// andamento do campeonato (mandos e chaveamentos reais).
// Pontos ainda a confirmar no REC oficial: empate nas quartas (jogo único) foi tratado como
// pênaltis, e o quadrangular do rebaixamento foi tratado sem pontos extras.

export const GAUCHO_2026 = {
  id: "gaucho-2026",
  nome: "Campeonato Gaúcho 2026",
  curto: "Gauchão",
  aba: "gaucho",
  zona: (posicao) => (posicao <= 4 ? "avanco" : "rebaixamento"),

  resultados: [
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
    { campo: "farroupilha", rotulo: "Troféu Farroupilha", classe: "copa" },
    { campo: "rebaixamento", rotulo: "Rebaixamento", classe: "rebaixamento" },
  ],
  totais: { quartas: 8, semifinal: 4, final: 2, titulo: 1, farroupilha: 1, rebaixamento: 2 },

  regras: [
    "1ª fase: 12 times em dois grupos de 6. Cada time enfrenta uma vez os 6 times do outro grupo (6 rodadas).",
    "Quartas de final (jogo único): 1º × 4º e 2º × 3º de cada grupo, na casa do 1º e do 2º. Empate: pênaltis (a confirmar no regulamento oficial).",
    "Semifinais (ida e volta): os 4 classificados são reordenados pela campanha somada; a 4ª melhor enfrenta a 1ª, e a 3ª enfrenta a 2ª. A melhor campanha decide em casa. Empate no agregado: pênaltis.",
    "Final (ida e volta): a melhor campanha decide em casa. Empate no agregado: pênaltis.",
    "Rebaixamento: os dois últimos de cada grupo jogam um quadrangular em ida e volta; os dois piores caem para a Série A2.",
    "Troféu Farroupilha: os 4 eliminados nas quartas, reordenados pela campanha, jogam semifinais e final em ida e volta. O campeão ganha a 5ª vaga do estado na Copa do Brasil 2027.",
  ],

  simular(sim, camp) {
    sim.jogarCalendario("primeira-fase");
    const A = sim.classificar(camp.grupos.A, "primeira-fase");
    const B = sim.classificar(camp.grupos.B, "primeira-fase");

    // Quartas: jogo único, na casa do 1º e do 2º colocado de cada grupo.
    const quartas = [
      sim.confronto("quartas", A[0], A[3], { pernas: 1, mandante: A[0] }),
      sim.confronto("quartas", A[1], A[2], { pernas: 1, mandante: A[1] }),
      sim.confronto("quartas", B[0], B[3], { pernas: 1, mandante: B[0] }),
      sim.confronto("quartas", B[1], B[2], { pernas: 1, mandante: B[1] }),
    ];

    // Semifinais: reordenados pela campanha; 4ª × 1ª e 3ª × 2ª.
    const ordem = sim.ordenarPorCampanha(quartas.map((q) => q.vencedor));
    const s1 = sim.confronto("semifinal", ordem[3], ordem[0]);
    const s2 = sim.confronto("semifinal", ordem[2], ordem[1]);
    const final = sim.confronto("final", s1.vencedor, s2.vencedor);

    // Quadrangular do rebaixamento.
    const quadrangular = [A[4], A[5], B[4], B[5]];
    sim.todosContraTodos("quadrangular", quadrangular);
    const ordemQuadrangular = sim.classificar(quadrangular, "quadrangular", { confrontoDireto: true });

    // Troféu Farroupilha: eliminados das quartas, reordenados pela campanha.
    const eliminados = sim.ordenarPorCampanha(quartas.map((q) => q.perdedor));
    const f1 = sim.confronto("farroupilha-semifinal", eliminados[0], eliminados[3]);
    const f2 = sim.confronto("farroupilha-semifinal", eliminados[1], eliminados[2]);
    const farroupilha = sim.confronto("farroupilha-final", f1.vencedor, f2.vencedor);

    return {
      quartas: [...A.slice(0, 4), ...B.slice(0, 4)],
      semifinal: quartas.map((q) => q.vencedor),
      final: [s1.vencedor, s2.vencedor],
      titulo: [final.vencedor],
      farroupilha: [farroupilha.vencedor],
      rebaixamento: ordemQuadrangular.slice(2),
    };
  },
};
