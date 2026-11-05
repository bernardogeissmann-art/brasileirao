// simulacao.test.js
// Testes automáticos do site/js/simulacao.js. Cada test(...) é uma verificação;
// se alguma conta der errado, o teste "falha" e mostra o que esperava e o que veio.
//
// Como rodar (na pasta do projeto):
//     npm test

import { test } from "node:test";              // ferramenta de testes que já vem no Node.js
import assert from "node:assert/strict";       // funções para conferir resultados
import { readFileSync } from "node:fs";        // lê arquivos do computador
import {
  simular, criarSorteador, chancesAcumuladas, sortearGols,
  criarEstatisticas, registrarResultado, montarTabela, tabelaAtual, chancesDoJogo,
} from "../site/js/simulacao.js";

// Lê os dados reais do projeto (o navegador usaria fetch; aqui lemos direto do disco).
function lerJson(caminho) {
  return JSON.parse(readFileSync(new URL(caminho, import.meta.url), "utf-8"));
}
const dados = { jogos: lerJson("../data/jogos.json"), modelo: lerJson("../data/modelo.json") };

// Números com vírgula têm pequenos erros de arredondamento (ex.: 0,1 + 0,2 = 0,30000000000000004).
// Por isso, "quase igual" aqui é: diferença menor que 0,000000001.
function quaseIgual(valor, esperado, mensagem) {
  assert.ok(Math.abs(valor - esperado) < 1e-9, `${mensagem}: veio ${valor}, esperado ${esperado}`);
}

// Uma simulação real, com semente fixa, usada pelos dois primeiros testes.
const resultado = simular(dados, { n: 10_000, sortear: criarSorteador(42) });

test("as probabilidades de título somam 100%", () => {
  const soma = resultado.times.reduce((total, time) => total + time.titulo, 0);
  quaseIgual(soma, 1, "soma dos títulos");
});

test("cada posição soma 100% (e cada time soma 100% entre as posições)", () => {
  for (let posicao = 0; posicao < 20; posicao++) {
    const soma = resultado.times.reduce((total, time) => total + time.posicoes[posicao], 0);
    quaseIgual(soma, 1, `soma da posição ${posicao + 1}`);
  }
  for (const time of resultado.times) {
    quaseIgual(time.posicoes.reduce((a, b) => a + b, 0), 1, `soma das posições do ${time.nome}`);
  }
  // As faixas também precisam fechar: 4 vagas de G4 e 4 de rebaixamento no total.
  quaseIgual(resultado.times.reduce((t, x) => t + x.g4, 0), 4, "soma do G4");
  quaseIgual(resultado.times.reduce((t, x) => t + x.rebaixamento, 0), 4, "soma do rebaixamento");
});

// Calcula a tabela "na mão", sem usar o simulacao.js, para comparar.
// Ordena por pontos, vitórias, saldo e gols pró.
function tabelaDireta(jogos, fixados) {
  const linhas = {};
  for (const id of Object.keys(jogos.times)) {
    linhas[id] = { id, pontos: 0, vitorias: 0, golsPro: 0, golsContra: 0 };
  }
  const placar = new Map(fixados.map((f) => [f.id, f]));
  for (const jogo of jogos.jogos) {
    const p = jogo.disputado ? jogo : placar.get(jogo.id);
    if (!p) continue;   // jogo que ainda não aconteceu e não foi fixado: não entra
    const casa = linhas[jogo.mandante];
    const fora = linhas[jogo.visitante];
    casa.golsPro += p.gols_mandante; casa.golsContra += p.gols_visitante;
    fora.golsPro += p.gols_visitante; fora.golsContra += p.gols_mandante;
    if (p.gols_mandante > p.gols_visitante) { casa.pontos += 3; casa.vitorias++; }
    else if (p.gols_mandante < p.gols_visitante) { fora.pontos += 3; fora.vitorias++; }
    else { casa.pontos++; fora.pontos++; }
  }
  const chave = (l) => [l.pontos, l.vitorias, l.golsPro - l.golsContra, l.golsPro];
  const ordem = Object.values(linhas).sort((a, b) => {
    const ca = chave(a), cb = chave(b);
    for (let i = 0; i < 4; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i];
    return 0;
  });
  // Existe algum par de times empatado em tudo (o que exigiria sorteio)?
  const temEmpateTotal = ordem.some((l, i) => i > 0 && chave(l).join() === chave(ordem[i - 1]).join());
  return { ordem, temEmpateTotal };
}

test("com todos os jogos fixados, tudo vira 0% ou 100% e bate com o cálculo direto", () => {
  const restantes = dados.jogos.jogos.filter((j) => !j.disputado);
  // Escolhe placares "inventados" para todos os jogos que faltam. Testa sementes até achar
  // placares sem nenhum empate total, porque nesse caso o regulamento mandaria sortear.
  let fixados, direta;
  for (let semente = 1; semente < 100; semente++) {
    const sortear = criarSorteador(semente);
    fixados = restantes.map((j) => ({
      id: j.id, gols_mandante: Math.floor(sortear() * 4), gols_visitante: Math.floor(sortear() * 3),
    }));
    direta = tabelaDireta(dados.jogos, fixados);
    if (!direta.temEmpateTotal) break;
  }
  assert.equal(direta.temEmpateTotal, false, "não achei placares sem empate total");

  const r = simular(dados, { n: 200, fixados, sortear: criarSorteador(7) });
  const porId = new Map(r.times.map((t) => [t.id, t]));

  direta.ordem.forEach((linha, posicaoEsperada) => {
    const time = porId.get(linha.id);
    time.posicoes.forEach((p, posicao) => {
      assert.equal(p, posicao === posicaoEsperada ? 1 : 0, `${time.nome} na posição ${posicao + 1}`);
    });
    assert.equal(time.pontosMedios, linha.pontos, `pontos do ${time.nome}`);
    for (const faixa of ["titulo", "g4", "libertadores", "sulamericana", "rebaixamento"]) {
      assert.ok(time[faixa] === 0 || time[faixa] === 1, `${faixa} do ${time.nome} é ${time[faixa]}`);
    }
  });
});

test("a tabela atual bate com o cálculo direto", () => {
  const direta = tabelaDireta(dados.jogos, []);
  const atual = tabelaAtual(dados.jogos);
  atual.forEach((linha, i) => {
    assert.equal(linha.pontos, direta.ordem[i].pontos, `pontos na posição ${i + 1}`);
    if (!direta.temEmpateTotal) assert.equal(linha.id, direta.ordem[i].id, `time na posição ${i + 1}`);
  });
  const jogosDisputados = dados.jogos.jogos.filter((j) => j.disputado).length;
  assert.equal(atual.reduce((t, l) => t + l.jogos, 0), 2 * jogosDisputados, "total de jogos");
});

test("confronto direto desempata quando só 2 times estão empatados", () => {
  // Times 0 e 1 terminam iguais em pontos, vitórias, saldo e gols pró,
  // mas o 1 venceu o confronto entre eles (1 vitória e 1 empate).
  const est = criarEstatisticas(4);
  registrarResultado(est, 1, 0, 2, 1);   // 1 vence 0 por 2x1
  registrarResultado(est, 0, 1, 0, 0);   // empate 0x0
  registrarResultado(est, 0, 2, 2, 1);   // 0 vence o 2 por 2x1
  registrarResultado(est, 3, 1, 2, 1);   // 1 perde para o 3 por 1x2
  // Agora os dois têm 4 pontos, 1 vitória, saldo 0 e 3 gols pró.
  // Com 50 sorteadores diferentes, o 1 tem que ficar na frente sempre (não pode ser sorte).
  for (let semente = 1; semente <= 50; semente++) {
    const tabela = montarTabela(est, criarSorteador(semente));
    assert.deepEqual(tabela.slice(0, 2), [1, 0]);
  }
});

test("com 3 times empatados o confronto direto não é usado (vai para o sorteio)", () => {
  // Três times empatados em tudo: o resultado deve variar conforme o sorteio.
  const est = criarEstatisticas(3);
  registrarResultado(est, 0, 1, 1, 0);
  registrarResultado(est, 1, 2, 1, 0);
  registrarResultado(est, 2, 0, 1, 0);
  const primeiros = new Set();
  const sortear = criarSorteador(3);
  for (let i = 0; i < 200; i++) primeiros.add(montarTabela(est, sortear)[0]);
  assert.equal(primeiros.size, 3, "os três times deveriam aparecer em 1º em algum sorteio");
});

test("o sorteio de gols segue a média do modelo (Poisson)", () => {
  const roleta = chancesAcumuladas(1.7);
  const sortear = criarSorteador(99);
  let soma = 0;
  const vezes = 200_000;
  for (let i = 0; i < vezes; i++) soma += sortearGols(roleta, sortear);
  const media = soma / vezes;
  assert.ok(Math.abs(media - 1.7) < 0.01, `média sorteada ${media}, esperada 1,7`);
});

test("a mesma semente dá exatamente o mesmo resultado", () => {
  const a = simular(dados, { n: 2_000, semente: 123 });
  const b = simular(dados, { n: 2_000, semente: 123 });
  assert.deepEqual(a, b);
});

test("palpite de vitória nunca diminui a chance de título (mesmos sorteios nos outros jogos)", () => {
  // Pega o próximo jogo do líder e fixa uma vitória dele.
  const lider = tabelaAtual(dados.jogos)[0].id;
  const jogo = dados.jogos.jogos.find((j) => !j.disputado && (j.mandante === lider || j.visitante === lider));
  const vitoria = jogo.mandante === lider
    ? { id: jogo.id, gols_mandante: 2, gols_visitante: 0 }
    : { id: jogo.id, gols_mandante: 0, gols_visitante: 2 };
  const semPalpite = simular(dados, { n: 5_000, semente: 99 });
  const comPalpite = simular(dados, { n: 5_000, semente: 99, fixados: [vitoria] });
  const chance = (r) => r.times.find((t) => t.id === lider).titulo;
  assert.ok(chance(comPalpite) >= chance(semPalpite),
    `título do líder caiu: ${chance(semPalpite)} -> ${chance(comPalpite)}`);
});

test("a tabela atual inclui os palpites", () => {
  const jogo = dados.jogos.jogos.find((j) => !j.disputado);
  const antes = tabelaAtual(dados.jogos).find((l) => l.id === jogo.mandante);
  const depois = tabelaAtual(dados.jogos, [{ id: jogo.id, gols_mandante: 3, gols_visitante: 0 }])
    .find((l) => l.id === jogo.mandante);
  assert.equal(depois.pontos, antes.pontos + 3);
  assert.equal(depois.jogos, antes.jogos + 1);
});

test("chances de um jogo isolado somam 100% e batem com o Python nos empates", () => {
  const jogo = dados.jogos.jogos.find((j) => !j.disputado);
  const c = chancesDoJogo(jogo, dados.modelo);
  quaseIgual(c.vitoriaM + c.empate + c.vitoriaV, 1, "vitória + empate + derrota");
  quaseIgual(c.golsM.reduce((a, b) => a + b, 0), 1, "chances de gols do mandante");
  // O estimar_modelo.py calculou 80,6 empates esperados nos 332 jogos disputados.
  const empatesEsperados = dados.jogos.jogos
    .filter((j) => j.disputado)
    .reduce((soma, j) => soma + chancesDoJogo(j, dados.modelo).empate, 0);
  assert.ok(Math.abs(empatesEsperados - 80.6) < 0.1, `empates esperados: ${empatesEsperados}`);
});

test("jogo já disputado não pode ser fixado", () => {
  const disputado = dados.jogos.jogos.find((j) => j.disputado);
  assert.throws(() => simular(dados, { n: 1, fixados: [{ id: disputado.id, gols_mandante: 1, gols_visitante: 0 }] }));
});
