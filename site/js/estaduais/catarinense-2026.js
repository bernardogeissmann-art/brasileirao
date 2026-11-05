// catarinense-2026.js
// O formato do Campeonato Catarinense Série A 2026, montado com as peças do motor.js.
// Fontes: relatório oficial de jogos da FCF, regras do REC 2026 descritas na Wikipédia e no
// ge.globo, e o próprio andamento do campeonato (mandos e chaveamentos reais).
// Para 2027: copie este arquivo, ajuste o que o novo regulamento mudar e registre em formatos.js.

export const CATARINENSE_2026 = {
  id: "catarinense-2026",
  nome: "Campeonato Catarinense 2026",
  curto: "Catarinense",
  aba: "catarinense",
  // Cor da faixa lateral de cada posição no grupo: 1º a 4º vão às quartas; 5º e 6º, ao quadrangular.
  zona: (posicao) => (posicao <= 4 ? "avanco" : "rebaixamento"),

  // O que a página mostra para cada time (na ordem das colunas).
  resultados: [
    { campo: "quartas", rotulo: "Quartas", classe: "avanco" },
    { campo: "semifinal", rotulo: "Semifinal", classe: "avanco" },
    { campo: "final", rotulo: "Final", classe: "avanco" },
    { campo: "titulo", rotulo: "Título", classe: "titulo" },
    { campo: "copaDoBrasil", rotulo: "Copa do Brasil", classe: "copa" },
    { campo: "rebaixamento", rotulo: "Rebaixamento", classe: "rebaixamento" },
  ],
  totais: { quartas: 8, semifinal: 4, final: 2, titulo: 1, copaDoBrasil: 3, rebaixamento: 3 },

  // As regras, em português simples, para a página explicar.
  regras: [
    "1ª fase: 12 times em dois grupos de 6. Cada time enfrenta uma vez os 6 times do outro grupo (6 rodadas).",
    "Desempate na 1ª fase: vitórias, saldo de gols, gols marcados, cartões e sorteio (cartões não dá para prever, então o site sorteia).",
    "Quartas de final (ida e volta): 1º × 4º e 2º × 3º de cada grupo. A melhor campanha decide em casa.",
    "Semifinal e final (ida e volta): o vencedor de 1ºA × 4ºA enfrenta o de 2ºB × 3ºB, e o de 1ºB × 4ºB enfrenta o de 2ºA × 3ºA. O mando do 2º jogo é de quem soma a melhor campanha no campeonato. Empate no agregado vai para os pênaltis.",
    "Rebaixamento: os dois últimos de cada grupo jogam um quadrangular em ida e volta. O melhor 5º colocado começa com 1 ponto. Só o 1º do quadrangular fica; os outros três caem para a Série B.",
    "Copa do Brasil 2027: o campeão, o vice e o campeão da Taça ACESC 70 Anos (disputada pelos eliminados no mata-mata) ganham vaga.",
  ],

  simular(sim, camp) {
    // 1ª fase: todos os jogos do calendário (reais ou sorteados).
    sim.jogarCalendario("primeira-fase");
    const A = sim.classificar(camp.grupos.A, "primeira-fase");
    const B = sim.classificar(camp.grupos.B, "primeira-fase");

    // Quartas de final: confrontos dentro do grupo.
    const q1 = sim.confronto("quartas", A[0], A[3]);
    const q2 = sim.confronto("quartas", A[1], A[2]);
    const q3 = sim.confronto("quartas", B[0], B[3]);
    const q4 = sim.confronto("quartas", B[1], B[2]);

    // Semifinais (cruzando os grupos) e final.
    const s1 = sim.confronto("semifinal", q1.vencedor, q4.vencedor);
    const s2 = sim.confronto("semifinal", q3.vencedor, q2.vencedor);
    const final = sim.confronto("final", s1.vencedor, s2.vencedor);

    // Quadrangular do rebaixamento, com 1 ponto extra para o melhor 5º colocado.
    const melhorQuinto = sim.ordenarPorCampanha([A[4], B[4]])[0];
    const quadrangular = [A[4], A[5], B[4], B[5]];
    sim.todosContraTodos("quadrangular", quadrangular);
    const ordemQuadrangular = sim.classificar(quadrangular, "quadrangular",
      { bonus: { [melhorQuinto]: 1 }, confrontoDireto: true });

    // Taça ACESC 70 Anos: eliminados das quartas (ida e volta), depois com os eliminados
    // das semifinais (jogo único na casa de quem caiu na semifinal) e final (ida e volta).
    const j = sim.confronto("acesc-eliminatorias", q1.perdedor, q4.perdedor);
    const k = sim.confronto("acesc-eliminatorias", q3.perdedor, q2.perdedor);
    const l = sim.confronto("acesc-semifinal", s1.perdedor, j.vencedor, { pernas: 1, mandante: s1.perdedor });
    const m = sim.confronto("acesc-semifinal", s2.perdedor, k.vencedor, { pernas: 1, mandante: s2.perdedor });
    const acesc = sim.confronto("acesc-final", l.vencedor, m.vencedor);

    return {
      quartas: [...A.slice(0, 4), ...B.slice(0, 4)],
      semifinal: [q1.vencedor, q2.vencedor, q3.vencedor, q4.vencedor],
      final: [s1.vencedor, s2.vencedor],
      titulo: [final.vencedor],
      copaDoBrasil: [final.vencedor, final.perdedor, acesc.vencedor],
      rebaixamento: ordemQuadrangular.slice(1),
    };
  },
};
