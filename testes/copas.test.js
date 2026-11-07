// copas.test.js
// Testes comuns às copas (Sul-Americana, Libertadores e Copa do Brasil). O principal: no último
// momento calculado, todos os jogos até ali são reais, então a simulação tem que reproduzir quem
// chegou a cada fase (sempre com 100%), e o mando de cada jogo real tem que bater com a regra.
// A Sul-Americana tem testes próprios, mais detalhados, em sulamericana.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simularMomento } from "../site/js/estaduais/motor.js";
import { FORMATOS } from "../site/js/estaduais/formatos.js";
import { mataMataEmAndamento, timesNaDisputa, confrontosAtuais } from "../site/js/estaduais/mata-mata.js";

const COPAS = ["sulamericana-2026", "libertadores-2026", "copa-do-brasil-2026"];

for (const id of COPAS) {
  const formato = FORMATOS[id];
  const ler = (arquivo) => JSON.parse(readFileSync(new URL(`../${formato.pasta}/${arquivo}`, import.meta.url), "utf-8"));
  const dados = ler("jogos.json");
  const modelos = ler("modelos.json");
  const ultimo = modelos.momentos[modelos.momentos.length - 1];

  test(`${id}: com os jogos reais, reproduz quem chegou a cada fase (100%) e o mando real`, () => {
    const r = simularMomento(dados, ultimo, formato, { n: 300, semente: 5 });
    assert.deepEqual(r.avisos, [], "o mando calculado pela regra é diferente do real");
    // Quem jogou uma fase no mundo real chegou a ela (as fases que ainda não têm jogos ficam de fora).
    for (const fase of ["oitavas", "quartas", "semifinal", "final"]) {
      const naFase = new Set(dados.jogos.filter((j) => j.fase === fase).flatMap((j) => [j.mandante, j.visitante]));
      if (naFase.size === 0) continue;
      assert.equal(naFase.size, formato.totais[fase], `${fase}: ${naFase.size} times nos jogos`);
      for (const time of Object.keys(dados.times)) {
        assert.equal(r.times[time][fase], naFase.has(time) ? 1 : 0, `${fase} de ${time}`);
      }
    }
  });

  test(`${id}: em todo momento, cada resultado soma o número certo de vagas`, () => {
    for (const momento of modelos.momentos) {
      const r = simularMomento(dados, momento, formato, { n: 300, semente: 9 });
      for (const [campo, total] of Object.entries(formato.totais)) {
        const soma = Object.values(r.times).reduce((s, t) => s + t[campo], 0);
        assert.ok(Math.abs(soma - total) < 1e-9, `${momento.id}: ${campo} soma ${soma}, esperado ${total}`);
      }
    }
  });

  test(`${id}: "Na disputa" mostra só quem ainda pode ser campeão, cada um num confronto`, () => {
    const chances = ler("chances.json");
    if (!mataMataEmAndamento(dados, chances)) return;   // copa já decidida: a página é a do histórico
    const naDisputa = timesNaDisputa(chances);
    const { confrontos, semAdversario } = confrontosAtuais(dados, naDisputa);
    const nosConfrontos = confrontos.flatMap((c) => c.times);
    assert.deepEqual([...nosConfrontos, ...semAdversario].sort(), [...naDisputa].sort());
  });
}

test("Copa do Brasil: nas semifinais, o placar da ida aparece no confronto", () => {
  const formato = FORMATOS["copa-do-brasil-2026"];
  const dados = JSON.parse(readFileSync(new URL(`../${formato.pasta}/jogos.json`, import.meta.url), "utf-8"));
  const ida = dados.jogos.find((j) => j.fase === "semifinal" && j.mandante === "gremio" && j.disputado);
  if (!ida) return;   // dados de outro ano
  const { confrontos } = confrontosAtuais(dados, ["gremio", "mineiro"]);
  const semi = confrontos.find((c) => c.fase === "semifinal");
  if (!semi || semi.vencedor) return;   // a volta já foi jogada
  assert.equal(semi.placar.gremio, ida.gols_mandante);
  assert.equal(semi.placar.mineiro, ida.gols_visitante);
  assert.equal(semi.proximo.mandante, "mineiro");
});
