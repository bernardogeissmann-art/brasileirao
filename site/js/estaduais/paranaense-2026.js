// paranaense-2026.js
// O formato do Campeonato Paranaense 2026, montado com as peças do motor.js.
// Fontes: jogos do site da Federação Paranaense de Futebol (FPF), regras do arbitral de 2026
// descritas na Wikipédia, Regulamento Geral das Competições da FPF (desempate, Art. 12) e o
// próprio andamento do campeonato (mandos e chaveamentos reais).
// Ponto não confirmado no regulamento: empate no agregado do "Torneio da Morte" foi tratado
// como pênaltis (em 2026 os dois confrontos tiveram vencedor no placar).

export const PARANAENSE_2026 = {
  id: "paranaense-2026",
  nome: "Campeonato Paranaense 2026",
  curto: "Paranaense",
  aba: "paranaense",
  // Faixa lateral: 1º a 4º de cada grupo vão às quartas; 5º e 6º, ao Torneio da Morte.
  zona: (posicao) => (posicao <= 4 ? "avanco" : "rebaixamento"),

  resultados: [
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
    { campo: "rebaixamento", rotulo: "Rebaixamento", classe: "rebaixamento" },
  ],
  totais: { quartas: 8, semifinal: 4, final: 2, titulo: 1, rebaixamento: 2 },

  regras: [
    "1ª fase: 12 times em dois grupos de 6. Cada time enfrenta uma vez os 6 times do outro grupo (6 rodadas).",
    "Desempate: vitórias, saldo de gols, gols marcados, confronto direto, cartões e sorteio (cartões não dá para prever, então o site sorteia).",
    "Quartas de final (ida e volta, dentro do grupo): 1º × 4º e 2º × 3º. A melhor campanha decide em casa. Empate no agregado: pênaltis.",
    "Semifinais (ida e volta, dentro do grupo): os dois vencedores das quartas de cada grupo se enfrentam. A melhor campanha somada decide em casa. Empate no agregado: pênaltis.",
    "Final (ida e volta): o campeão do lado do Grupo A enfrenta o do Grupo B. A melhor campanha decide em casa. Empate no agregado: pênaltis.",
    "Torneio da Morte (ida e volta): 5º do Grupo A × 6º do Grupo B e 5º do Grupo B × 6º do Grupo A. Quem perde cai para a 2ª divisão.",
  ],

  simular(sim, camp) {
    sim.jogarCalendario("primeira-fase");
    const A = sim.classificar(camp.grupos.A, "primeira-fase", { confrontoDireto: true });
    const B = sim.classificar(camp.grupos.B, "primeira-fase", { confrontoDireto: true });

    // Quartas e semifinais dentro de cada grupo.
    const qA1 = sim.confronto("quartas", A[0], A[3]);
    const qA2 = sim.confronto("quartas", A[1], A[2]);
    const qB1 = sim.confronto("quartas", B[0], B[3]);
    const qB2 = sim.confronto("quartas", B[1], B[2]);
    const sA = sim.confronto("semifinal", qA1.vencedor, qA2.vencedor);
    const sB = sim.confronto("semifinal", qB1.vencedor, qB2.vencedor);
    const final = sim.confronto("final", sA.vencedor, sB.vencedor);

    // Torneio da Morte: quem perde o confronto é rebaixado.
    const d1 = sim.confronto("descenso", A[4], B[5]);
    const d2 = sim.confronto("descenso", B[4], A[5]);

    return {
      quartas: [...A.slice(0, 4), ...B.slice(0, 4)],
      semifinal: [qA1.vencedor, qA2.vencedor, qB1.vencedor, qB2.vencedor],
      final: [sA.vencedor, sB.vencedor],
      titulo: [final.vencedor],
      rebaixamento: [d1.perdedor, d2.perdedor],
    };
  },
};
