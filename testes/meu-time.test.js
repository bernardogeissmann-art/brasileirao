// meu-time.test.js
// Testes da página Meu Time: o texto em português (artigos, casos especiais), o pedido
// que vai para a IA, a conferência da resposta e a limpeza das notícias. Também confere o
// arquivo gerado (data/meu-time.json). Nenhum teste usa a IA de verdade: quando precisa,
// usa uma IA "de mentira" que devolve uma resposta pronta (não gasta nada, nem precisa de internet).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escreverTexto, porcento } from "../scripts/meu_time/texto.js";
import { limparTitulo, eDoTime } from "../scripts/meu_time/noticias.js";
import { montarPedido, conferirTexto, escreverTextoComIA, MODELO } from "../scripts/meu_time/texto_ia.js";

// Um time "de mentira" com tudo preenchido; cada teste muda só o que precisa.
function info(mudancas = {}) {
  return {
    id: "flamengo", nome: "Flamengo", posicao: 1, pontos: 76,
    ultimos: [
      { adversario: "gremio", nomeAdversario: "Grêmio", emCasa: true, golsPro: 3, golsContra: 1, resultado: "V" },
      { adversario: "vasco-da-gama", nomeAdversario: "Vasco da Gama", emCasa: false, golsPro: 4, golsContra: 1, resultado: "V" },
      { adversario: "mineiro", nomeAdversario: "Atlético Mineiro", emCasa: true, golsPro: 3, golsContra: 2, resultado: "V" },
      { adversario: "bahia", nomeAdversario: "Bahia", emCasa: false, golsPro: 3, golsContra: 0, resultado: "V" },
      { adversario: "fluminense", nomeAdversario: "Fluminense", emCasa: true, golsPro: 1, golsContra: 0, resultado: "V" },
    ],
    sequencia: { vitorias: 5, invicto: 11, derrotas: 0, semVencer: 0 },
    chances: { titulo: 0.87, libertadores: 1, sulamericana: 0, rebaixamento: 0 },
    proximo: { adversario: "paranaense", nomeAdversario: "Athletico Paranaense", emCasa: true, dia: "quarta, 18/11", vitoria: 0.7 },
    ...mudancas,
  };
}
const noticia = (veiculo) => [{ titulo: "Uma notícia qualquer", veiculo, link: "https://exemplo.com", data: "2026-11-04T10:00:00Z" }];

test("o texto não tem pedaços quebrados e cita o próximo jogo", () => {
  const texto = escreverTexto(info(), noticia("Globo Esporte"), "2026-11-05");
  assert.ok(!/undefined|NaN|null/.test(texto), texto);
  assert.match(texto, /O Flamengo/);
  assert.match(texto, /Athletico, em casa, quarta, 18\/11/);   // usa o nome curto ("Athletico")
  assert.match(texto, /favorito: 70% de chance de vitória/);
});

test("times femininos e resultados já decididos", () => {
  const texto = escreverTexto(info({
    id: "chapecoense", nome: "Chapecoense", posicao: 20, pontos: 21,
    chances: { titulo: 0, libertadores: 0, sulamericana: 0, rebaixamento: 1 },
    proximo: null,
  }), [], "2026-11-05");
  assert.match(texto, /\b[Aa] Chapecoense/);
  assert.doesNotMatch(texto, /\b[Oo] Chapecoense/);
  assert.match(texto, /rebaixamento já está confirmado/);
  assert.match(texto, /A temporada da Chapecoense no Brasileirão já terminou/);
  assert.doesNotMatch(texto, /100%/);
});

test("ESPN é feminino: 'segundo a ESPN'", () => {
  for (const dia of ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]) {
    const texto = escreverTexto(info(), noticia("ESPN"), dia);
    assert.doesNotMatch(texto, /segundo o ESPN/);
  }
});

test("porcentagens em texto", () => {
  assert.equal(porcento(0.814), "81%");
  assert.equal(porcento(0.004), "menos de 1%");
  assert.equal(porcento(0.996), "mais de 99%");
});

test("limpeza dos títulos das notícias", () => {
  assert.equal(limparTitulo("São Paulo perde para o Bahia - 28/10/2026 - Esporte - Folha de S.Paulo"), "São Paulo perde para o Bahia");
  assert.equal(limparTitulo("Flamengo vence o Grêmio - ge"), "Flamengo vence o Grêmio");
  assert.equal(eDoTime("Flamengo vence no NBB", ["Flamengo"]), false);         // outro esporte
  assert.equal(eDoTime("Internacional x Bragantino na Copa do Brasil Feminina", ["Internacional"]), false);
  assert.equal(eDoTime("Réver é preso em Porto Alegre", ["Internacional", "Inter "]), false);   // não é do time
  assert.equal(eDoTime("Maripán desfalca o Inter contra o Vasco", ["Internacional", "Inter "]), true);
});

test("o conteúdo gerado tem os 20 times, com texto e notícias", () => {
  const conteudo = JSON.parse(readFileSync(new URL("../data/meu-time.json", import.meta.url), "utf-8"));
  const jogos = JSON.parse(readFileSync(new URL("../data/jogos.json", import.meta.url), "utf-8"));
  for (const id of Object.keys(jogos.times)) {
    const doTime = conteudo.times[id];
    assert.ok(doTime, `${id} sem conteúdo`);
    assert.ok(doTime.texto.length > 100 && !/undefined|NaN/.test(doTime.texto), `texto de ${id}`);
    for (const n of doTime.noticias) assert.ok(n.titulo && n.link.startsWith("http") && n.veiculo, `notícia de ${id}`);
  }
});

// ----- Texto escrito por IA -----

const PARAGRAFO = "O Flamengo atravessa uma fase de sonho: cinco vitórias nos últimos cinco jogos e um ataque " +
  "que não para de balançar as redes. Na liderança, com 76 pontos, o título está cada vez mais perto, com 87% de " +
  "chance pelas nossas simulações, e a vaga na Libertadores já está garantida. Se há um ponto de atenção, é a " +
  "defesa, que ainda sofre gols bobos. Agora o desafio é o Athletico, em casa, na quarta, e o modelo aponta o " +
  "Mengão como favorito, com 70% de chance de vitória.";

// Uma IA "de mentira": guarda o pedido recebido e devolve a resposta combinada.
function iaDeMentira(resposta) {
  const ia = { pedidos: [] };
  ia.messages = { create: async (pedido) => { ia.pedidos.push(pedido); return resposta; } };
  return ia;
}

test("o pedido para a IA traz os dados do time, sem pedaços quebrados", () => {
  const pedido = montarPedido(info({ campanha: { jogos: 34, vitorias: 23, empates: 7, derrotas: 4, golsPro: 70, golsContra: 28 } }),
    noticia("ESPN"), "2026-11-05");
  assert.ok(!/undefined|NaN|null/.test(pedido), pedido);
  assert.match(pedido, /chame de "o Flamengo"/);
  assert.match(pedido, /1º lugar, com 76 pontos/);
  assert.match(pedido, /Faltam 4 rodadas/);
  assert.match(pedido, /título: 87%/);
  assert.match(pedido, /Libertadores: já garantida/);                 // 100% vira "já garantida"
  assert.match(pedido, /rebaixamento: nenhum risco/);                  // 0% vira "nenhum risco"
  assert.match(pedido, /vitória por 3 a 1 contra o Grêmio, em casa/);
  assert.match(pedido, /contra o Athletico, em casa, quarta, 18\/11/);
  assert.match(pedido, /<manchetes>\n- \[ESPN, 04\/11\] Uma notícia qualquer\n<\/manchetes>/);
});

test("o pedido avisa quando a temporada acabou e usa 'a Chapecoense'", () => {
  const pedido = montarPedido(info({
    id: "chapecoense", nome: "Chapecoense", posicao: 20, pontos: 21,
    chances: { titulo: 0, libertadores: 0, sulamericana: 0, rebaixamento: 1 }, proximo: null,
  }), [], "2026-11-05");
  assert.match(pedido, /chame de "a Chapecoense"/);
  assert.match(pedido, /rebaixamento já confirmado/);
  assert.match(pedido, /temporada do time no Brasileirão já terminou/);
  assert.match(pedido, /nenhuma notícia encontrada/);
});

test("a conferência aceita um parágrafo e recusa respostas estranhas", () => {
  assert.equal(conferirTexto(`  “${PARAGRAFO}”  `), PARAGRAFO);            // tira espaços e aspas em volta
  assert.throws(() => conferirTexto("Curto demais."), /curto/);
  assert.throws(() => conferirTexto(`**Situação atual**\n${PARAGRAFO}`), /formatação/);
  assert.throws(() => conferirTexto(`- ${PARAGRAFO}`), /formatação/);
  assert.throws(() => conferirTexto(`${PARAGRAFO}\n\n${PARAGRAFO}`), /parágrafo/);
  assert.throws(() => conferirTexto(PARAGRAFO.repeat(5)), /longo/);
});

test("com a IA de mentira: devolve o parágrafo e manda o pedido certo", async () => {
  const ia = iaDeMentira({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: PARAGRAFO }] });
  const texto = await escreverTextoComIA(ia, info(), noticia("Globo Esporte"), "2026-11-05");
  assert.equal(texto, PARAGRAFO);
  const pedido = ia.pedidos[0];
  assert.equal(pedido.model, MODELO);
  assert.equal(MODELO, "claude-haiku-5-5");
  assert.equal(pedido.output_config.effort, "low");
  assert.match(pedido.messages[0].content, /Flamengo/);
});

test("com a IA de mentira: se ela se recusar ou parar no meio, dá erro (e entram as frases prontas)", async () => {
  for (const motivo of ["refusal", "max_tokens"]) {
    const ia = iaDeMentira({ stop_reason: motivo, content: [{ type: "text", text: PARAGRAFO }] });
    await assert.rejects(escreverTextoComIA(ia, info(), [], "2026-11-05"), new RegExp(motivo));
  }
});

// ----- Vídeos do YouTube -----

test("a lista de canais do YouTube está bem preenchida", () => {
  const canais = JSON.parse(readFileSync(new URL("../data/canais-youtube.json", import.meta.url), "utf-8"));
  const jogos = JSON.parse(readFileSync(new URL("../data/jogos.json", import.meta.url), "utf-8"));
  const vistos = new Set();
  for (const [idTime, lista] of Object.entries(canais.times)) {
    assert.ok(jogos.times[idTime], `time desconhecido: ${idTime}`);
    assert.ok(lista.length >= 1 && lista.length <= 3, `${idTime}: de 1 a 3 canais`);
    for (const c of lista) {
      assert.ok(["imprensa", "oficial", "destaque"].includes(c.tipo), `${idTime}: tipo de ${c.nome}`);
      // "destaque" é um vídeo avulso (11 letras); os outros são uma playlist (PL...) ou um canal (UC...).
      const [codigo, regra] = c.tipo === "destaque" ? [c.video, /^[\w-]{11}$/]
        : c.playlist ? [c.playlist, /^PL[\w-]{16,40}$/] : [c.canal, /^UC[\w-]{22}$/];
      assert.match(codigo, regra, `${idTime}: código de ${c.nome}`);
      assert.ok(c.nome && c.arroba.startsWith("@"), `${idTime}: nome e @ de ${c.nome}`);
      assert.ok(!vistos.has(codigo), `repetido: ${c.nome}`);
      vistos.add(codigo);
    }
  }
});

// ----- Rádios -----

test("a lista de rádios está bem preenchida (e só com transmissões https)", () => {
  const { radios, times } = JSON.parse(readFileSync(new URL("../data/radios.json", import.meta.url), "utf-8"));
  const jogos = JSON.parse(readFileSync(new URL("../data/jogos.json", import.meta.url), "utf-8"));
  for (const [chave, r] of Object.entries(radios)) {
    assert.ok(r.nome && r.cidade, `${chave}: nome e cidade`);
    assert.ok(Number.isInteger(r.radiosnet), `${chave}: número na RadiosNet`);
    assert.match(r.transmissao, /^https:\/\//, `${chave}: a transmissão precisa ter https (o site é https)`);
    assert.match(r.pagina, /^https:\/\/www\.radios\.com\.br\/aovivo\/.+\/\d+$/, `${chave}: página na RadiosNet`);
  }
  for (const [idTime, lista] of Object.entries(times)) {
    assert.ok(jogos.times[idTime], `time desconhecido: ${idTime}`);
    assert.ok(lista.length >= 1 && lista.length <= 3, `${idTime}: de 1 a 3 rádios`);
    for (const chave of lista) assert.ok(radios[chave], `${idTime}: rádio desconhecida ${chave}`);
  }
  assert.deepEqual(times.chapecoense, ["ndfm-chapeco", "oeste-capital", "super-conda"]);
  assert.deepEqual(times.internacional, ["gaucha", "grenal"]);
  assert.deepEqual(times.gremio, ["gaucha", "grenal"]);
});

// ----- Quando cada coisa é atualizada -----

test("texto novo só para quem jogou há uns 30 minutos e ainda está com o texto de antes do jogo", async () => {
  const { timesQuePrecisamDeTexto } = await import("../scripts/meu_time/quem_jogou.js");
  const jogos = [
    { data: "2026-11-05T19:30:00-03:00", mandante: "palmeiras", visitante: "clube-do-remo" },
    { data: "2026-11-05T21:30:00-03:00", mandante: "cruzeiro", visitante: "bahia" },
  ];
  const meuTime = { times: { palmeiras: { texto_em: "2026-11-05T22:30:00-03:00" } } };   // já escrito depois do jogo
  // 21h50: o jogo das 19h30 começou há 140 minutos -> Remo precisa; Palmeiras já tem texto novo.
  assert.deepEqual(timesQuePrecisamDeTexto(jogos, meuTime, new Date("2026-11-05T21:50:00-03:00")), ["clube-do-remo"]);
  // 23h40: o das 21h30 também já passou dos 140 minutos.
  assert.deepEqual(timesQuePrecisamDeTexto(jogos, meuTime, new Date("2026-11-05T23:55:00-03:00")),
    ["bahia", "clube-do-remo", "cruzeiro"]);
  // 20h30: nenhum jogo terminou há 30 minutos ainda.
  assert.deepEqual(timesQuePrecisamDeTexto(jogos, meuTime, new Date("2026-11-05T20:30:00-03:00")), []);
  // Mais de 24 horas depois: fica para a rede de segurança da madrugada.
  assert.deepEqual(timesQuePrecisamDeTexto(jogos, meuTime, new Date("2026-11-07T10:00:00-03:00")), []);
});

test("as notícias novas entram no lugar das mais velhas (no máximo 6, dos últimos 10 dias)", async () => {
  const { juntarNoticias } = await import("../scripts/meu_time/noticias.js");
  const n = (i, dia) => ({ titulo: `Notícia ${i}`, veiculo: "ESPN", link: `https://exemplo.com/${i}`, data: `2026-11-${dia}T10:00:00Z` });
  const antigas = [n(1, "04"), n(2, "03"), n(3, "02"), n(4, "01"), n(5, "01"), n(6, "01")];
  const juntas = juntarNoticias(antigas, [n(7, "05"), n(1, "04")], new Date("2026-11-05T12:00:00Z"));
  assert.equal(juntas.length, 6);
  assert.equal(juntas[0].titulo, "Notícia 7");                   // a nova entra em primeiro
  assert.equal(juntas.filter((x) => x.titulo === "Notícia 1").length, 1);   // sem repetir
  assert.deepEqual(juntarNoticias([n(1, "01")], [], new Date("2026-11-20T12:00:00Z")), []);   // velha demais sai
});

test("o texto só é reescrito quando o resultado do jogo já chegou", async () => {
  const { escolherTimes } = await import("../scripts/meu_time/atualizar_textos.js");
  const jogos = [
    { data: "2026-11-05T19:30:00-03:00", mandante: "palmeiras", visitante: "clube-do-remo", disputado: true },
    { data: "2026-11-05T21:30:00-03:00", mandante: "cruzeiro", visitante: "bahia", disputado: false },
  ];
  const ids = ["palmeiras", "clube-do-remo", "cruzeiro", "bahia"];
  const agora = new Date("2026-11-05T23:59:00-03:00");
  assert.deepEqual(escolherTimes({ times: ["palmeiras", "cruzeiro"] }, jogos, { times: {} }, ids, agora), ["palmeiras"]);
  // Rede de segurança: quem tem resultado mais novo que o texto.
  const conteudo = { times: { palmeiras: { texto_em: "2026-11-05T22:00:00-03:00" } } };
  assert.deepEqual(escolherTimes({ depoisDosJogos: true }, jogos, conteudo, ids, agora), ["clube-do-remo"]);
});
