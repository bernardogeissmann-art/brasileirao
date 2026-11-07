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
import {
  mataMataEmAndamento, timesNaDisputa, confrontosAtuais, campanhaDoTime, caminhoDoTime, descreverFase, diasAte,
} from "../site/js/estaduais/mata-mata.js";
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

// ---------------------------------------------------------------------------
// "NA DISPUTA": a parte da página que aparece enquanto o mata-mata está rolando
// ---------------------------------------------------------------------------

const chances = ler("chances.json");
const copia = (x) => JSON.parse(JSON.stringify(x));

test("Na disputa: a Sul-Americana está no mata-mata; um estadual que acabou, não", () => {
  assert.equal(mataMataEmAndamento(dados, chances), true);
  const lerEstadual = (arquivo) =>
    JSON.parse(readFileSync(new URL(`../data/estaduais/paulista-2026/${arquivo}`, import.meta.url), "utf-8"));
  assert.equal(mataMataEmAndamento(lerEstadual("jogos.json"), lerEstadual("chances.json")), false);
});

test("Na disputa: só os finalistas, num confronto só (a final, ainda sem vencedor)", () => {
  const naDisputa = timesNaDisputa(chances);
  assert.deepEqual([...naDisputa].sort(), ["boca-juniors", "mineiro"]);
  const { confrontos, semAdversario } = confrontosAtuais(dados, naDisputa);
  assert.equal(confrontos.length, 1);
  assert.deepEqual(semAdversario, []);
  const final = confrontos[0];
  assert.equal(final.fase, "final");
  assert.deepEqual(final.times, ["mineiro", "boca-juniors"]);
  if (!final.vencedor) assert.equal(final.proximo.fase, "final");
});

test("Na disputa: a final que acabou agora (antes de recalcular as chances) mostra o campeão", () => {
  const depois = copia(dados);
  const final = depois.jogos.find((j) => j.fase === "final");
  Object.assign(final, { disputado: true, gols_mandante: 1, gols_visitante: 1, penaltis_mandante: 3, penaltis_visitante: 4 });
  const { confrontos } = confrontosAtuais(depois, ["boca-juniors", "mineiro"]);
  assert.equal(confrontos[0].vencedor, "boca-juniors");
  assert.equal(confrontos[0].proximo, null);
});

test("Na disputa: o caminho de cada finalista até aqui", () => {
  const galo = caminhoDoTime(dados, "mineiro", formato);
  assert.deepEqual(galo.map((e) => e.fase), ["Fase de grupos", "Oitavas de final", "Quartas de final", "Semifinal"]);
  assert.equal(galo[0].texto, "1º no Grupo B · 10 pts");
  const quartas = galo[2];   // 0 x 2 e 4 x 2 contra o Santos: 4 x 4 no placar somado, 3 x 1 nos pênaltis
  assert.deepEqual([quartas.adversario, quartas.golsPro, quartas.golsContra, quartas.penaltis], ["santos", 4, 4, "3 x 1"]);
  const boca = caminhoDoTime(dados, "boca-juniors", formato);
  assert.match(boca[0].texto, /Libertadores/);
  assert.deepEqual(boca.slice(1).map((e) => e.fase), ["Playoffs", "Oitavas de final", "Quartas de final", "Semifinal"]);
  assert.equal(boca[1].penaltis, "4 x 3");   // O'Higgins: 1 x 1 no placar somado
  assert.ok(boca.slice(1).every((e) => e.venceu));
});

test("Na disputa: campanha, nome da fase e dias até o jogo", () => {
  const boca = campanhaDoTime(dados, "boca-juniors");
  assert.equal(boca.jogos, 8);
  assert.equal(boca.vitorias + boca.empates + boca.derrotas, 8);
  const final = dados.jogos.find((j) => j.fase === "final");
  assert.equal(descreverFase(final), "Final · jogo único em campo neutro");
  assert.equal(descreverFase({ fase: "quartas", perna: 2 }), "Quartas de final · volta");
  assert.equal(diasAte("2026-11-21T19:30:00-03:00", new Date("2026-11-06T23:00:00-03:00")), 15);
  assert.equal(diasAte("2026-11-21T19:30:00-03:00", new Date("2026-11-21T08:00:00-03:00")), 0);
});
