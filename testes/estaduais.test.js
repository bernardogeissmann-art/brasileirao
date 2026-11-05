// estaduais.test.js
// Testes dos campeonatos estaduais. O principal: no momento "Fim do campeonato" todos os
// jogos são reais, então a simulação tem que reproduzir exatamente o que aconteceu
// (campeão, rebaixados, classificados), sempre com 100%. Se o formato tiver alguma regra
// errada (chaveamento, mando, bônus), esse teste falha.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simularMomento, tabelaDoGrupo } from "../site/js/estaduais/motor.js";
import { FORMATOS } from "../site/js/estaduais/formatos.js";

function ler(campeonato, arquivo) {
  return JSON.parse(readFileSync(new URL(`../data/estaduais/${campeonato}/${arquivo}`, import.meta.url), "utf-8"));
}

// O que de fato aconteceu em 2026 (conferido na Wikipédia e nos sites das federações).
const REAL = {
  "catarinense-2026": {
    titulo: ["barra"],
    final: ["barra", "chapecoense"],
    semifinal: ["barra", "brusque", "camboriu", "chapecoense"],
    quartas: ["avai", "barra", "brusque", "camboriu", "chapecoense", "concordia", "criciuma", "santa-catarina"],
    copaDoBrasil: ["barra", "chapecoense", "criciuma"],
    rebaixamento: ["carlos-renaux", "figueirense", "joinville"],
  },
  "gaucho-2026": {
    titulo: ["gremio"],
    final: ["gremio", "internacional"],
    semifinal: ["gremio", "internacional", "juventude", "ypiranga"],
    quartas: ["caxias", "gremio", "internacional", "juventude", "novo-hamburgo", "sao-jose", "sao-luiz", "ypiranga"],
    farroupilha: ["sao-luiz"],
    rebaixamento: ["avenida", "inter-sm"],
  },
};

for (const [campeonato, real] of Object.entries(REAL)) {
  const dados = ler(campeonato, "jogos.json");
  const modelos = ler(campeonato, "modelos.json");
  const formato = FORMATOS[campeonato];
  const fim = modelos.momentos.find((m) => m.id === "final-2");

  test(`${campeonato}: com todos os jogos reais, reproduz o que aconteceu (100%)`, () => {
    const r = simularMomento(dados, fim, formato, { n: 300, semente: 5 });
    assert.deepEqual(r.avisos, [], "o mando calculado pela regra é diferente do real");
    for (const [campo, times] of Object.entries(real)) {
      for (const id of Object.keys(dados.times)) {
        const esperado = times.includes(id) ? 1 : 0;
        assert.equal(r.times[id][campo], esperado, `${campo} de ${id}`);
      }
    }
  });

  test(`${campeonato}: em todo momento, cada resultado soma o número certo de vagas`, () => {
    for (const momento of modelos.momentos) {
      const r = simularMomento(dados, momento, formato, { n: 400, semente: 9 });
      for (const [campo, total] of Object.entries(formato.totais)) {
        const soma = Object.values(r.times).reduce((s, t) => s + t[campo], 0);
        assert.ok(Math.abs(soma - total) < 1e-9, `${momento.id}: ${campo} soma ${soma}, esperado ${total}`);
      }
    }
  });

  test(`${campeonato}: a tabela da 1ª fase no fim tem 6 times por grupo e 6 jogos cada`, () => {
    for (const grupo of ["A", "B"]) {
      const tabela = tabelaDoGrupo(dados, fim, grupo);
      assert.equal(tabela.length, 6);
      for (const linha of tabela) assert.equal(linha.jogos, 6, `${linha.id} jogos`);
    }
  });
}
