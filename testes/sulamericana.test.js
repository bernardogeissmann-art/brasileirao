// sulamericana.test.js
// Testes da Copa Sul-Americana 2026. O principal: no último momento calculado, todos os jogos
// até ali são reais, então a simulação tem que reproduzir exatamente quem avançou em cada fase
// (sempre com 100%) e o mando de cada jogo real tem que bater com a "numeração" da CONMEBOL.
// Também testa a escolha dos "Jogos do dia" (nos dias da Sul-Americana, ela vem primeiro).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simularMomento, tabelaDoGrupo } from "../site/js/estaduais/motor.js";
import { FORMATOS } from "../site/js/estaduais/formatos.js";
import { copaNoDia } from "../site/js/jogos-do-dia.js";
import { golsEsperados } from "../site/js/simulacao.js";

const formato = FORMATOS["sulamericana-2026"];
const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../${formato.pasta}/${arquivo}`, import.meta.url), "utf-8"));
const dados = ler("jogos.json");
const modelos = ler("modelos.json");
const ultimo = modelos.momentos[modelos.momentos.length - 1];

// O que de fato aconteceu em 2026 (jogos da ESPN).
const REAL = {
  primeiros: { A: "macara", B: "mineiro", C: "sao-paulo", D: "deportivo-recoleta", E: "botafogo",
    F: "montevideo-city-torque", G: "olimpia", H: "river-plate" },
  segundos: { A: "tigre", B: "cienciano", C: "ohiggins", D: "santos", E: "caracas", F: "gremio",
    G: "vasco-da-gama", H: "bragantino" },
  quartas: ["boca-juniors", "cienciano", "mineiro", "montevideo-city-torque", "santa-fe", "santos", "sao-paulo",
    "vasco-da-gama"],
  semifinal: ["boca-juniors", "mineiro", "montevideo-city-torque", "vasco-da-gama"],
  final: ["boca-juniors", "mineiro"],
};

test("Sul-Americana: com os jogos reais, reproduz quem avançou em cada fase (100%)", () => {
  const r = simularMomento(dados, ultimo, formato, { n: 300, semente: 5 });
  assert.deepEqual(r.avisos, [], "o mando calculado pela regra é diferente do real");
  const oitavas = [...Object.values(REAL.primeiros), "boca-juniors", "bolivar", "bragantino", "cienciano",
    "santa-fe", "santos", "tigre", "vasco-da-gama"];
  const esperado = { oitavas, quartas: REAL.quartas, semifinal: REAL.semifinal, final: REAL.final };
  for (const [campo, times] of Object.entries(esperado)) {
    for (const id of Object.keys(dados.times)) {
      assert.equal(r.times[id][campo], times.includes(id) ? 1 : 0, `${campo} de ${id}`);
    }
  }
  // O título fica entre os dois finalistas (ou com o campeão, se a final já foi jogada).
  const final = dados.jogos.find((j) => j.fase === "final");
  for (const id of Object.keys(dados.times)) {
    if (!REAL.final.includes(id)) assert.equal(r.times[id].titulo, 0, `título de ${id}`);
  }
  if (final.disputado) {
    const empate = final.gols_mandante === final.gols_visitante;
    const venceuMandante = empate ? final.penaltis_mandante > final.penaltis_visitante : final.gols_mandante > final.gols_visitante;
    assert.equal(r.times[venceuMandante ? final.mandante : final.visitante].titulo, 1);
  } else {
    assert.ok(r.times.mineiro.titulo > 0 && r.times["boca-juniors"].titulo > 0);
  }
});

test("Sul-Americana: em todo momento, cada resultado soma o número certo de vagas", () => {
  for (const momento of modelos.momentos) {
    const r = simularMomento(dados, momento, formato, { n: 300, semente: 9 });
    for (const [campo, total] of Object.entries(formato.totais)) {
      const soma = Object.values(r.times).reduce((s, t) => s + t[campo], 0);
      assert.ok(Math.abs(soma - total) < 1e-9, `${momento.id}: ${campo} soma ${soma}, esperado ${total}`);
    }
  }
});

test("Sul-Americana: a tabela de cada grupo, com o desempate da CONMEBOL, bate com a realidade", () => {
  const fimDosGrupos = modelos.momentos.find((m) => m.id === "rodada-6");
  for (const grupo of Object.keys(REAL.primeiros)) {
    const tabela = tabelaDoGrupo(dados, fimDosGrupos, grupo, { conmebol: true });
    assert.equal(tabela.length, 4, `grupo ${grupo}`);
    for (const linha of tabela) assert.equal(linha.jogos, 6, `${linha.id} jogos`);
    assert.equal(tabela[0].id, REAL.primeiros[grupo], `1º do grupo ${grupo}`);
    assert.equal(tabela[1].id, REAL.segundos[grupo], `2º do grupo ${grupo}`);
  }
  // Grupo B: Academia Puerto Cabello e Juventud somaram 7 pontos; a Juventud ganhou o
  // confronto direto (4 x 0 e 1 x 1) e fica à frente, mesmo com menos vitórias.
  const b = tabelaDoGrupo(dados, fimDosGrupos, "B", { conmebol: true }).map((l) => l.id);
  assert.deepEqual(b.slice(2), ["juventud", "academia-puerto-cabello"]);
  // Os que vieram da Libertadores: a tabela deles soma os jogos de todas as fases.
  const lib = tabelaDoGrupo(dados, ultimo, "LIB", { todasAsFases: true });
  assert.equal(lib.find((l) => l.id === "boca-juniors").jogos, 8);   // playoffs, oitavas, quartas e semifinal
});

test("Sul-Americana: em campo neutro não há fator casa", () => {
  const modelo = { fator_casa: 1.4, times: { a: { ataque: 1.2, defesa: 1 }, b: { ataque: 1, defesa: 1 } } };
  assert.deepEqual(golsEsperados({ mandante: "a", visitante: "b" }, modelo), [1.2 * 1.4, 1]);
  assert.deepEqual(golsEsperados({ mandante: "a", visitante: "b", neutro: true }, modelo), [1.2, 1]);
});

// Jogos "de mentira" para testar a escolha do dia.
const jogo = (id, data) => ({ id, data, mandante: "x", visitante: "y", disputado: false });
const SULA = [jogo("s1", "2026-11-21T19:30:00-03:00")];
const SERIE_A = [jogo("a1", "2026-11-19T21:30:00-03:00"), jogo("a2", "2026-11-21T16:00:00-03:00")];
const SERIE_B = [jogo("b1", "2026-11-22T16:00:00-03:00")];

test("Jogos do dia: o dia da Sul-Americana vale mesmo com jogo da Série A no mesmo dia", () => {
  const escolha = copaNoDia(SULA, [SERIE_A, SERIE_B], new Date("2026-11-21T10:00:00-03:00"));
  assert.equal(escolha.dia, "2026-11-21");
  assert.equal(escolha.eHoje, true);
  assert.deepEqual(escolha.jogos.map((j) => j.id), ["s1"]);
});

test("Jogos do dia: se a Série A joga antes da Sul-Americana, vale a Série A", () => {
  assert.equal(copaNoDia(SULA, [SERIE_A, SERIE_B], new Date("2026-11-19T10:00:00-03:00")), null);
});

test("Jogos do dia: sem jogo hoje, a Sul-Americana aparece se o próximo dia com jogo é dela", () => {
  const escolha = copaNoDia(SULA, [SERIE_A, SERIE_B], new Date("2026-11-20T10:00:00-03:00"));
  assert.equal(escolha.dia, "2026-11-21");
  assert.equal(escolha.eHoje, false);
});

test("Jogos do dia: depois da final, a Sul-Americana sai de cena", () => {
  const final = [{ ...SULA[0], disputado: true, gols_mandante: 1, gols_visitante: 0 }];
  assert.equal(copaNoDia(final, [SERIE_B], new Date("2026-11-22T10:00:00-03:00")), null);
});
