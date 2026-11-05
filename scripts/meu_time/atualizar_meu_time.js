// atualizar_meu_time.js
// Prepara o conteúdo da página Meu Time para os 20 times do Brasileirão:
//   - o parágrafo "Situação atual" (texto em tom de conversa), escrito por IA (texto_ia.js).
//     Sem a chave ANTHROPIC_API_KEY, ou se a IA falhar, o texto sai com as frases prontas
//     de texto.js, e a página continua funcionando;
//   - as notícias recentes (ge, UOL Esporte e ESPN).
// Salva tudo em data/meu-time.json. O GitHub Actions roda este script às quartas e aos
// domingos, às 23h. As estatísticas e as chances da página são calculadas na hora, no
// navegador, com os dados do dia.
//
// Como rodar (na pasta do projeto, depois de baixar os jogos e estimar o modelo):
//     node scripts/meu_time/atualizar_meu_time.js

import { readFileSync, writeFileSync } from "node:fs";
import { simular, tabelaAtual, chancesDoJogo } from "../../site/js/simulacao.js";
import { buscarNoticias } from "./noticias.js";
import { escreverTexto } from "./texto.js";
import { criarCliente, escreverTextoComIA, chaveRecusada } from "./texto_ia.js";

const raiz = new URL("../../", import.meta.url);

// No seu computador, a chave da IA fica no arquivo .env; esta linha copia o que está lá para
// as variáveis de ambiente. No GitHub não existe .env (a chave vem dos "secrets"): tudo bem.
try { process.loadEnvFile(new URL(".env", raiz)); } catch { /* sem .env */ }

const ler = (caminho) => JSON.parse(readFileSync(new URL(caminho, raiz), "utf-8"));
const jogos = ler("data/jogos.json");
const modelo = ler("data/modelo.json");
const times = jogos.times;

// As chances de cada time (mesma simulação do site).
const resultado = simular({ jogos, modelo }, { n: 10_000, semente: 7 });
const chances = new Map(resultado.times.map((t) => [t.id, t]));
const tabela = new Map(tabelaAtual(jogos).map((linha) => [linha.id, linha]));

// Dia da semana e data de um jogo: "quarta, 05/11".
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const diaDoJogo = (iso) => `${formatoDia.format(new Date(iso)).replace("-feira", "")}, ${formatoData.format(new Date(iso))}`;

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

const hoje = new Date();
const dia = hoje.toISOString().slice(0, 10);
const saida = { gerado_em: hoje.toISOString(), times: {} };

// O "cliente" da IA (null se não houver chave).
const cliente = criarCliente();
if (!cliente) console.log("Sem a chave ANTHROPIC_API_KEY: os textos saem com as frases prontas.");
let falhasSeguidas = 0;   // se a IA falhar 3 vezes seguidas, desistimos dela nesta rodada

for (const id of Object.keys(times)) {
  console.log(`${times[id].nome}...`);
  const noticias = await buscarNoticias(id);
  const info = montarInfo(id);

  // Primeiro tenta a IA; se não der, usa as frases prontas.
  let texto = null;
  let autor = "frases";
  if (cliente && falhasSeguidas < 3) {
    try {
      texto = await escreverTextoComIA(cliente, info, noticias, dia);
      autor = "ia";
      falhasSeguidas = 0;
    } catch (erro) {
      falhasSeguidas = chaveRecusada(erro) ? 3 : falhasSeguidas + 1;
      console.warn(`  A IA falhou (${erro.message}). Usando as frases prontas.`);
    }
  }
  texto ??= escreverTexto(info, noticias, dia);

  saida.times[id] = { texto, autor, noticias };
  console.log(`  ${noticias.length} notícias; texto: ${autor === "ia" ? "IA" : "frases prontas"}`);
}

writeFileSync(new URL("data/meu-time.json", raiz), JSON.stringify(saida, null, 1), "utf-8");
console.log("Salvo: data/meu-time.json");
