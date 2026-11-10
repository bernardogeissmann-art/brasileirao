// contexto.js
// Junta, para cada time, tudo o que o texto "Situação atual" precisa saber: posição, campanha,
// últimos resultados, sequência, chances (mesma simulação do site) e o próximo jogo.
// Também lê e grava o arquivo data/meu-time.json. Não é rodado sozinho: os scripts
// atualizar_textos.js, atualizar_noticias.js e atualizar_meu_time.js usam as funções daqui.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { simular, tabelaAtual, chancesDoJogo } from "../../site/js/simulacao.js";
import { brigasDoTime } from "../../site/js/briga.js";

export const RAIZ = new URL("../../", import.meta.url);
const ARQUIVO_MEU_TIME = new URL("data/meu-time.json", RAIZ);

const lerJson = (caminho) => JSON.parse(readFileSync(new URL(caminho, RAIZ), "utf-8"));

// O conteúdo atual da página Meu Time (ou um conteúdo vazio, se o arquivo ainda não existir).
export function lerMeuTime() {
  return existsSync(ARQUIVO_MEU_TIME) ? lerJson("data/meu-time.json") : { times: {} };
}

export function salvarMeuTime(conteudo) {
  conteudo.gerado_em = new Date().toISOString();
  writeFileSync(ARQUIVO_MEU_TIME, JSON.stringify(conteudo, null, 1), "utf-8");
}

// Dia da semana e data de um jogo: "quarta, 05/11".
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const diaDoJogo = (iso) => `${formatoDia.format(new Date(iso)).replace("-feira", "")}, ${formatoData.format(new Date(iso))}`;

// Os campeonatos com página Meu Time. Os identificadores dos times não se repetem entre eles.
export const CAMPEONATOS = ["serie-a", "serie-b"];

// Jogos, modelo, chances e tabela de um campeonato (pasta data/<campeonato>/).
function carregarCampeonato(campeonato) {
  const pasta = `data/${campeonato}/`;
  const jogos = lerJson(`${pasta}jogos.json`);
  const modelo = lerJson(`${pasta}modelo.json`);
  const config = lerJson(`${pasta}configuracao.json`);
  // "condicionais": também as chances conforme o resultado do próximo jogo (para as brigas da reta final).
  const resultado = simular({ jogos, modelo, config }, { n: 10_000, semente: 7, condicionais: true });
  const lista = tabelaAtual(jogos);
  return {
    campeonato, jogos, modelo, config, resultado, lista,
    chances: new Map(resultado.times.map((t) => [t.id, t])),
    tabela: new Map(lista.map((linha) => [linha.id, linha])),
  };
}

// Todos os jogos e todos os times das Séries A e B juntos (para os scripts que só olham
// horários e nomes, como o quem_jogou.js e o atualizar_noticias.js).
export function jogosDeTodos() {
  const lista = CAMPEONATOS.map((c) => lerJson(`data/${c}/jogos.json`));
  return {
    jogos: lista.flatMap((d) => [...d.jogos, ...(d.playoff ?? [])]),
    times: Object.assign({}, ...lista.map((d) => d.times)),
  };
}

// Carrega jogos, modelo e chances uma vez só (Séries A e B). Devolve os dados e a função montarInfo(id).
export function carregarContexto() {
  const porCampeonato = CAMPEONATOS.map(carregarCampeonato);
  const times = Object.assign({}, ...porCampeonato.map((c) => c.jogos.times));
  const campeonatoDe = (id) => porCampeonato.find((c) => c.jogos.times[id]);
  // "jogos" junta os jogos dos dois campeonatos (quem jogou, quando).
  const jogos = { times, jogos: porCampeonato.flatMap((c) => [...c.jogos.jogos, ...(c.jogos.playoff ?? [])]) };

  // Tudo o que o texto precisa saber de um time.
  function montarInfo(id) {
    const { campeonato, jogos, modelo, config, resultado, lista, chances, tabela } = campeonatoDe(id);
    const doTime = jogos.jogos.filter((j) => j.mandante === id || j.visitante === id);
    const disputados = doTime.filter((j) => j.disputado).sort((a, b) => b.data.localeCompare(a.data));

    const doPontoDeVista = (j) => {
      const emCasa = j.mandante === id;
      const golsPro = emCasa ? j.gols_mandante : j.gols_visitante;
      const golsContra = emCasa ? j.gols_visitante : j.gols_mandante;
      const adversario = emCasa ? j.visitante : j.mandante;
      return {
        adversario, nomeAdversario: times[adversario].nome, emCasa, golsPro, golsContra,
        resultado: golsPro > golsContra ? "V" : golsPro === golsContra ? "E" : "D",
      };
    };
    const todos = disputados.map(doPontoDeVista);

    // Sequências atuais (contando do jogo mais recente para trás).
    const contar = (condicao) => {
      let n = 0;
      while (n < todos.length && condicao(todos[n])) n++;
      return n;
    };
    const sequencia = {
      vitorias: contar((j) => j.resultado === "V"),
      invicto: contar((j) => j.resultado !== "D"),
      derrotas: contar((j) => j.resultado === "D"),
      semVencer: contar((j) => j.resultado !== "V"),
    };

    // O próximo jogo, com as chances de vitória do ponto de vista do time.
    const futuro = doTime.filter((j) => !j.disputado).sort((a, b) => a.data.localeCompare(b.data))[0];
    let proximo = null;
    if (futuro) {
      const c = chancesDoJogo(futuro, modelo);
      const emCasa = futuro.mandante === id;
      const adversario = emCasa ? futuro.visitante : futuro.mandante;
      proximo = { adversario, nomeAdversario: times[adversario].nome, emCasa, dia: diaDoJogo(futuro.data),
        vitoria: emCasa ? c.vitoriaM : c.vitoriaV, empate: c.empate, derrota: emCasa ? c.vitoriaV : c.vitoriaM };
    }

    const linha = tabela.get(id);
    const empates = linha.pontos - 3 * linha.vitorias;   // cada vitória vale 3 pontos e cada empate, 1
    const campanha = { jogos: linha.jogos, vitorias: linha.vitorias, empates, derrotas: linha.jogos - linha.vitorias - empates,
      golsPro: linha.golsPro, golsContra: linha.golsContra };
    // Brigas da reta final (título, acesso, rebaixamento): o texto passa a girar em torno delas.
    const nomes = Object.fromEntries(Object.entries(jogos.times).map(([outro, t]) => [outro, t.nome]));
    const brigas = brigasDoTime({ id, campeonato, faixas: config.faixas, resultado, tabela: lista, jogos: jogos.jogos })
      .map((briga) => ({ ...briga, nomes }));   // os nomes dos times citados, para escrever o texto
    return {
      id, nome: times[id].nome, campeonato, posicao: linha.posicao, pontos: linha.pontos, campanha,
      ultimos: todos.slice(0, 5), sequencia, chances: chances.get(id), proximo, brigas,
    };
  }

  return { jogos, times, montarInfo };
}
