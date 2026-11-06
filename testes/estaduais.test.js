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
  "paulista-2026": {
    titulo: ["palmeiras"],
    final: ["novorizontino", "palmeiras"],
    semifinal: ["corinthians", "novorizontino", "palmeiras", "sao-paulo"],
    quartas: ["bragantino", "capivariano", "corinthians", "novorizontino", "palmeiras", "portuguesa", "santos", "sao-paulo"],
    rebaixamento: ["ponte-preta", "velo-clube"],
  },
  "paranaense-2026": {
    titulo: ["operario"],
    final: ["londrina", "operario"],
    semifinal: ["athletico", "coritiba", "londrina", "operario"],
    quartas: ["athletico", "azuriz", "cianorte", "coritiba", "foz-do-iguacu", "londrina", "operario", "sao-joseense"],
    rebaixamento: ["andraus", "galo-maringa"],
  },
};

// Como é a 1ª fase de cada campeonato: grupo -> [quantos times, quantos jogos cada um faz].
const PRIMEIRA_FASE = {
  "catarinense-2026": { A: [6, 6], B: [6, 6] },
  "gaucho-2026": { A: [6, 6], B: [6, 6] },
  "paulista-2026": { A: [16, 8] },
  "paranaense-2026": { A: [6, 6], B: [6, 6] },
};

for (const [campeonato, real] of Object.entries(REAL)) {
  const dados = ler(campeonato, "jogos.json");
  const modelos = ler(campeonato, "modelos.json");
  const formato = FORMATOS[campeonato];
  const fim = modelos.momentos[modelos.momentos.length - 1];   // o último momento: fim do campeonato

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

  test(`${campeonato}: a tabela da 1ª fase no fim tem o número certo de times e de jogos`, () => {
    assert.equal(fim.id, "final-2", "o último momento deveria ser o fim do campeonato");
    for (const [grupo, [nTimes, nJogos]] of Object.entries(PRIMEIRA_FASE[campeonato])) {
      const tabela = tabelaDoGrupo(dados, fim, grupo);
      assert.equal(tabela.length, nTimes, `grupo ${grupo}`);
      for (const linha of tabela) assert.equal(linha.jogos, nJogos, `${linha.id} jogos`);
    }
  });
}
