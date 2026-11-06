// jogos-do-dia.test.js
// Testes da seção "Jogos do dia": que dia é hoje em Brasília, quais jogos mostrar,
// a sequência recente dos times e a situação de cada jogo. Usa jogos "de mentira" e
// horários fixos, para o teste dar o mesmo resultado em qualquer dia.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diaEmBrasilia, escolherJogosDoDia, formaRecente, situacaoDoJogo } from "../site/js/jogos-do-dia.js";

const jogo = (id, data, mandante, visitante, placar = null, extra = {}) => ({
  id, data, mandante, visitante, disputado: placar !== null,
  gols_mandante: placar?.[0] ?? null, gols_visitante: placar?.[1] ?? null, ...extra,
});

const JOGOS = [
  jogo(1, "2026-11-01T16:00:00-03:00", "a", "b", [2, 0]),
  jogo(2, "2026-11-02T19:00:00-03:00", "c", "a", [1, 1]),
  jogo(3, "2026-11-05T21:30:00-03:00", "a", "d"),
  jogo(4, "2026-11-05T19:30:00-03:00", "b", "c"),
  jogo(5, "2026-11-08T16:00:00-03:00", "d", "b"),
  jogo(6, "2026-11-05T20:00:00-03:00", "c", "d", null, { status_fonte: "POSTPONED" }),
];

test("o dia é contado no horário de Brasília", () => {
  // 01:30 em Londres (UTC) do dia 6 ainda é 22:30 do dia 5 em Brasília.
  assert.equal(diaEmBrasilia(new Date("2026-11-06T01:30:00Z")), "2026-11-05");
  assert.equal(diaEmBrasilia(new Date("2026-11-06T03:30:00Z")), "2026-11-06");
});

test("mostra os jogos de hoje, em ordem de horário, sem os adiados", () => {
  const escolha = escolherJogosDoDia(JOGOS, new Date("2026-11-05T12:00:00-03:00"));
  assert.equal(escolha.eHoje, true);
  assert.equal(escolha.dia, "2026-11-05");
  assert.deepEqual(escolha.jogos.map((j) => j.id), [4, 3]);
});

test("sem jogo hoje, mostra o próximo dia com jogo; sem jogos futuros, nada", () => {
  const escolha = escolherJogosDoDia(JOGOS, new Date("2026-11-06T12:00:00-03:00"));
  assert.equal(escolha.eHoje, false);
  assert.equal(escolha.dia, "2026-11-08");
  assert.deepEqual(escolha.jogos.map((j) => j.id), [5]);
  assert.equal(escolherJogosDoDia(JOGOS, new Date("2026-12-20T12:00:00-03:00")), null);
});

test("a sequência recente vai do jogo mais antigo ao mais recente", () => {
  assert.deepEqual(formaRecente(JOGOS, "a"), ["V", "E"]);
  assert.deepEqual(formaRecente(JOGOS, "b"), ["D"]);
  assert.deepEqual(formaRecente(JOGOS, "d"), []);
  const muitos = Array.from({ length: 8 }, (_, i) => jogo(i, `2026-10-${10 + i}T16:00:00-03:00`, "x", "y", [i % 2, 0]));
  assert.deepEqual(formaRecente(muitos, "x"), ["V", "E", "V", "E", "V"]);   // só os 5 últimos
});

test("a situação do jogo muda com o relógio", () => {
  const j = JOGOS[2];   // 21:30 do dia 5
  assert.equal(situacaoDoJogo(j, new Date("2026-11-05T20:00:00-03:00")), "antes");
  assert.equal(situacaoDoJogo(j, new Date("2026-11-05T22:15:00-03:00")), "andamento");
  assert.equal(situacaoDoJogo(j, new Date("2026-11-06T00:30:00-03:00")), "aguardando");
  assert.equal(situacaoDoJogo(JOGOS[0], new Date("2026-11-05T20:00:00-03:00")), "encerrado");
});

test("no jogos.json, a transmissão é uma lista de canais (ou vazia)", () => {
  const dados = JSON.parse(readFileSync(new URL("../data/jogos.json", import.meta.url), "utf-8"));
  for (const j of dados.jogos) {
    if (j.transmissao == null) continue;
    assert.ok(Array.isArray(j.transmissao) && j.transmissao.length > 0, `jogo ${j.id}`);
    for (const canal of j.transmissao) assert.ok(typeof canal === "string" && canal.length > 0 && canal !== "Cartola");
  }
});
