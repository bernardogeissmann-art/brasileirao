// contexto.js
// Junta, para cada time, tudo o que o texto "Situação atual" precisa saber: posição, campanha,
// últimos resultados, sequência, chances (mesma simulação do site) e o próximo jogo.
// Também lê e grava o arquivo data/meu-time.json. Não é rodado sozinho: os scripts
// atualizar_textos.js, atualizar_noticias.js e atualizar_meu_time.js usam as funções daqui.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { simular, tabelaAtual, chancesDoJogo } from "../../site/js/simulacao.js";

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

// Carrega jogos, modelo e chances uma vez só. Devolve os dados e a função montarInfo(id).
export function carregarContexto() {
  const jogos = lerJson("data/jogos.json");
  const modelo = lerJson("data/modelo.json");
  const times = jogos.times;
  const resultado = simular({ jogos, modelo }, { n: 10_000, semente: 7 });
  const chances = new Map(resultado.times.map((t) => [t.id, t]));
  const tabela = new Map(tabelaAtual(jogos).map((linha) => [linha.id, linha]));

  // Tudo o que o texto precisa saber de um time.
  function montarInfo(id) {
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
    return {
      id, nome: times[id].nome, posicao: linha.posicao, pontos: linha.pontos, campanha,
      ultimos: todos.slice(0, 5), sequencia, chances: chances.get(id), proximo,
    };
  }

  return { jogos, modelo, times, montarInfo };
}
