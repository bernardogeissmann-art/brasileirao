// serie-b.test.js
// Testes da Série B: o mesmo motor de simulação (site/js/simulacao.js) com a ficha da
// Série B (data/serie-b/configuracao.json), que tem o playoff do 3º ao 6º colocado.
//
// Como rodar (na pasta do projeto):
//     npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { simular, tabelaAtual, jogarPlayoff, FAIXAS } from "../site/js/simulacao.js";

function lerJson(caminho) {
  return JSON.parse(readFileSync(new URL(caminho, import.meta.url), "utf-8"));
}
const dadosB = () => ({
  jogos: lerJson("../data/serie-b/jogos.json"),
  modelo: lerJson("../data/serie-b/modelo.json"),
  config: lerJson("../data/serie-b/configuracao.json"),
});
const soma = (lista, campo) => lista.reduce((total, item) => total + item[campo], 0);
function quaseIgual(valor, esperado, mensagem) {
  assert.ok(Math.abs(valor - esperado) < 1e-9, `${mensagem}: veio ${valor}, esperado ${esperado}`);
}

const resultado = simular(dadosB(), { n: 10_000, semente: 42 });

test("Série B: título soma 100%; acesso, playoff e rebaixamento somam 4 vagas", () => {
  quaseIgual(soma(resultado.times, "titulo"), 1, "soma dos títulos");
  quaseIgual(soma(resultado.times, "acesso"), 4, "soma do acesso (2 diretos + 2 do playoff)");
  quaseIgual(soma(resultado.times, "acesso_direto"), 2, "soma do acesso direto");
  quaseIgual(soma(resultado.times, "playoff"), 4, "soma de quem vai ao playoff");
  quaseIgual(soma(resultado.times, "rebaixamento"), 4, "soma do rebaixamento");
});

test("Série B: cada posição soma 100% (e cada time soma 100% entre as posições)", () => {
  for (let posicao = 0; posicao < 20; posicao++) {
    quaseIgual(resultado.times.reduce((t, x) => t + x.posicoes[posicao], 0), 1, `posição ${posicao + 1}`);
  }
  for (const time of resultado.times) {
    quaseIgual(time.posicoes.reduce((a, b) => a + b, 0), 1, `posições do ${time.nome}`);
    // O acesso nunca é menor que o acesso direto, nem maior que acesso direto + playoff.
    assert.ok(time.acesso >= time.acesso_direto - 1e-12, `acesso do ${time.nome}`);
    assert.ok(time.acesso <= time.acesso_direto + time.playoff + 1e-12, `acesso do ${time.nome}`);
  }
});

test("Série B: com tudo fixado (inclusive o playoff), tudo vira 0% ou 100%", () => {
  const dados = dadosB();
  // Todos os jogos que faltam: vitória do mandante por 2 a 0.
  const fixados = dados.jogos.jogos.filter((j) => !j.disputado)
    .map((j) => ({ id: j.id, gols_mandante: 2, gols_visitante: 0 }));
  const tabela = tabelaAtual(dados.jogos, fixados);
  const naPosicao = (p) => tabela[p - 1].id;
  // Sem empate total em nenhum ponto da tabela (senão haveria sorteio e não daria 0% ou 100%).
  const chave = (l) => [l.pontos, l.vitorias, l.saldo, l.golsPro].join();
  assert.ok(tabela.every((l, i) => i === 0 || chave(l) !== chave(tabela[i - 1])), "há empate total");

  // O playoff "já jogado": no 3º x 6º, o 3º vence a ida fora e empata a volta (passa o 3º).
  // No 4º x 5º, cada um vence em casa, mas o 5º tem saldo melhor (2 a 0 contra 1 a 0): passa o 5º.
  const jogo = (id, mandante, visitante, gm, gv) => ({ id, mandante, visitante, disputado: true, gols_mandante: gm, gols_visitante: gv });
  dados.jogos.playoff = [
    jogo(1, naPosicao(6), naPosicao(3), 0, 1), jogo(2, naPosicao(3), naPosicao(6), 1, 1),
    jogo(3, naPosicao(5), naPosicao(4), 2, 0), jogo(4, naPosicao(4), naPosicao(5), 1, 0),
  ];

  const r = simular(dados, { n: 500, fixados, semente: 7 });
  const porId = new Map(r.times.map((t) => [t.id, t]));
  const sobem = new Set([naPosicao(1), naPosicao(2), naPosicao(3), naPosicao(5)]);
  for (const linha of tabela) {
    const t = porId.get(linha.id);
    assert.equal(t.posicoes[linha.posicao - 1], 1, `posição do ${t.nome}`);
    assert.equal(t.titulo, linha.posicao === 1 ? 1 : 0, `título do ${t.nome}`);
    assert.equal(t.acesso, sobem.has(linha.id) ? 1 : 0, `acesso do ${t.nome}`);
    assert.equal(t.rebaixamento, linha.posicao >= 17 ? 1 : 0, `rebaixamento do ${t.nome}`);
  }
});

test("playoff: pontos, depois saldo, depois quem ficou mais bem colocado", () => {
  // placarDe(mandante, visitante) devolve o placar de uma lista pronta. Times: 3 (melhor) e 6 (pior).
  const com = (ida, volta) => (m, v) => (m === 6 ? ida : volta);   // ida na casa do 6, volta na do 3
  assert.equal(jogarPlayoff(3, 6, com([1, 0], [0, 0])), 6, "o 6 venceu a ida e empatou a volta: mais pontos");
  assert.equal(jogarPlayoff(3, 6, com([1, 0], [3, 0])), 3, "uma vitória para cada lado: o 3 tem saldo melhor");
  assert.equal(jogarPlayoff(3, 6, com([2, 1], [1, 0])), 3, "pontos e saldo iguais: passa o mais bem colocado");
  assert.equal(jogarPlayoff(3, 6, com([0, 0], [0, 0])), 3, "dois empates: passa o mais bem colocado");
});

test("as faixas da ficha da Série A são as mesmas do motor (FAIXAS)", () => {
  assert.deepEqual(lerJson("../data/serie-a/configuracao.json").faixas, FAIXAS);
});

test("Série B: 380 jogos, 20 times, cada um com 19 jogos em casa e escudo no projeto", () => {
  const { jogos } = dadosB();
  assert.equal(jogos.jogos.length, 380);
  const ids = Object.keys(jogos.times);
  assert.equal(ids.length, 20);
  for (const id of ids) {
    assert.equal(jogos.jogos.filter((j) => j.mandante === id).length, 19, `jogos em casa do ${id}`);
    const escudo = jogos.times[id].escudo;
    assert.ok(escudo && existsSync(new URL(`../${escudo}`, import.meta.url)), `escudo do ${id}`);
    assert.ok(escudo.startsWith(`assets/escudos/${id}.`), `o escudo usa o mesmo identificador (${id})`);
    assert.ok(jogos.times[id].nome_espn, `nome na ESPN do ${id}`);
  }
  assert.equal(jogos.liga_espn, "bra.2");
  // Os nomes do ge (onde assistir) apontam para times que existem nos dados.
  const nomesGe = Object.values(lerJson("../data/serie-b/configuracao.json").ge.nomes);
  assert.deepEqual([...nomesGe].sort(), [...ids].sort());
});
