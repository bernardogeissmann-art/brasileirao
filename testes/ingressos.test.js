// ingressos.test.js
// Testes das regras do botão "Comprar ingressos" (site/js/ingressos.js) e da lista de lojas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enderecoDoIngresso, msAteOProximoInicio } from "../site/js/ingressos.js";

const lojas = { times: { casa: { url: "https://loja.exemplo.com" } } };
const jogo = { mandante: "casa", visitante: "fora", data: "2026-11-08T16:00:00-03:00", disputado: false };

test("o botão leva à loja do time da casa e some na hora do início", () => {
  assert.equal(enderecoDoIngresso(jogo, lojas, new Date("2026-11-08T15:59:00-03:00")), "https://loja.exemplo.com");
  assert.equal(enderecoDoIngresso(jogo, lojas, new Date("2026-11-08T16:00:00-03:00")), null, "começou: some");
  assert.equal(enderecoDoIngresso({ ...jogo, disputado: true }, lojas, new Date("2026-11-01")), null, "já jogado");
  assert.equal(enderecoDoIngresso({ ...jogo, mandante: "fora", visitante: "casa" }, lojas, new Date("2026-11-01")), null,
    "a loja do visitante não vale: quem vende é o mandante");
  assert.equal(enderecoDoIngresso(jogo, null, new Date("2026-11-01")), null, "sem lista de lojas, sem botão");
});

test("o despertador aponta para o próximo início", () => {
  const agora = new Date("2026-11-08T15:00:00-03:00");
  const outro = { ...jogo, data: "2026-11-08T18:30:00-03:00" };
  assert.equal(msAteOProximoInicio([outro, jogo], agora), 60 * 60 * 1000);
  assert.equal(msAteOProximoInicio([{ ...jogo, disputado: true }], agora), null);
});

test("a lista de lojas só tem clubes das Séries A e B, com endereço https", () => {
  const ler = (c) => JSON.parse(readFileSync(new URL(c, import.meta.url), "utf-8"));
  const times = { ...ler("../data/serie-a/jogos.json").times, ...ler("../data/serie-b/jogos.json").times };
  for (const [id, loja] of Object.entries(ler("../data/ingressos.json").times)) {
    assert.ok(times[id], `time desconhecido: ${id}`);
    assert.match(loja.url, /^https:\/\//, `${id}: endereço com https`);
  }
});
