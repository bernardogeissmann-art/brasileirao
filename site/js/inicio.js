// inicio.js
// O script da página principal. Ele:
//   1) desenha o topo e o rodapé;
//   2) carrega os dados (jogos.json e modelo.json);
//   3) roda as 10.000 simulações no navegador;
//   4) monta os destaques e a lista de times com as chances;
//   5) monta a seção "Jogos do dia", no fim da página: primeiro os da Série A e, abaixo,
//      os da Série B (com um botão para a página da Série B).

import { carregarDados, simular, tabelaAtual, chancesDoJogo, N_SIMULACOES_PADRAO } from "./simulacao.js";
import {
  instalarCabecalho, montarRodape, cardTime, cartaoDestaque, mensagem, legendaCategorias, cabecalhoColunas,
  cardConfronto, legendaResultado,
} from "./componentes.js";
import { lerIngressos, enderecoDoIngresso, msAteOProximoInicio } from "./ingressos.js";
import { escolherJogosDoDia, formaRecente, situacaoComPlacar, temJogoRolando, atualizarComEspn } from "./jogos-do-dia.js";

// document.getElementById pega um elemento da página pelo seu id="...".
const topo = document.getElementById("topo");
const rodape = document.getElementById("rodape");
const chapeu = document.getElementById("chapeu");
const destaques = document.getElementById("destaques");
const lista = document.getElementById("lista-times");
const nota = document.getElementById("nota");

// innerHTML troca o conteúdo de um elemento pelo HTML que montamos.
instalarCabecalho(topo, "inicio");
rodape.innerHTML = montarRodape(null);
document.getElementById("legenda").innerHTML = legendaCategorias();
document.getElementById("cabecalho-colunas").innerHTML = cabecalhoColunas();
lista.innerHTML = mensagem(
  `Simulando ${N_SIMULACOES_PADRAO.toLocaleString("pt-BR")} finais de campeonato…`, "carregando");

iniciar();

async function iniciar() {
  let dados;
  try {
    dados = await carregarDados();
  } catch (erro) {
    mostrarErro(erro);
    return;
  }

  rodape.innerHTML = montarRodape(dados.jogos.baixado_em);

  // Antes de simular: os jogos que já acabaram, mas ainda estão sem resultado no site,
  // ganham o placar final da ESPN. Assim a tabela já sai certa.
  const [{ aoVivo }, lojas] = await Promise.all([atualizarComEspn(dados.jogos), lerIngressos()]);
  ingressos = lojas;
  montarJogosDoDia(dados, aoVivo, SERIE_A);   // não depende da simulação: aparece logo
  acompanharJogosDoDia(dados, SERIE_A, () => calcularEMostrar(dados));
  iniciarSerieB();   // sem "await": a Série B aparece quando os dados dela chegarem

  // Dá um instante para o navegador desenhar a mensagem "Simulando..." antes da conta pesada.
  await new Promise((pronto) => setTimeout(pronto, 30));
  calcularEMostrar(dados);
}

// Roda as simulações e desenha a tabela, os destaques e a nota. É chamada ao abrir a página
// e de novo sempre que um jogo do dia acaba.
function calcularEMostrar(dados) {
  const { jogos } = dados;
  const restantes = jogos.jogos.filter((jogo) => !jogo.disputado).length;
  chapeu.textContent = `Brasileirão Série A ${jogos.temporada} · faltam ${restantes} de ${jogos.jogos.length} jogos`;

  const inicio = performance.now();               // marca a hora de início (em milésimos)
  const resultado = simular(dados);
  const segundos = (performance.now() - inicio) / 1000;

  // Map: uma "agenda" que acha as chances de um time pelo id dele.
  const chancesPorId = new Map(resultado.times.map((t) => [t.id, t]));
  const tabela = tabelaAtual(jogos);

  lista.innerHTML = tabela
    .map((linha) => cardTime({ linha, time: jogos.times[linha.id], chances: chancesPorId.get(linha.id) }))
    .join("");

  destaques.innerHTML = montarDestaques(resultado.times, jogos.times);

  const n = resultado.simulacoes.toLocaleString("pt-BR");
  const tempo = segundos.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  nota.textContent =
    `A faixa colorida na lateral de cada card mostra a zona em que o time está hoje ` +
    `(listrada: fase preliminar da Libertadores). ` +
    `"–" quer dizer que não aconteceu em nenhuma das ${n} simulações. ` +
    `As faixas seguem o regulamento de 2026 e podem descer se o campeão ou o vice da Copa do Brasil ` +
    `já estiver classificado. Calculado no seu navegador em ${tempo} s.`;
}

// Os três destaques do topo: o favorito ao título e as disputas mais abertas
// (o time com chance mais perto de 50% no G4 e no rebaixamento).
function montarDestaques(chances, times) {
  const favorito = [...chances].sort((a, b) => b.titulo - a.titulo)[0];
  const maisAberto = (campo) =>
    chances
      .filter((t) => t[campo] > 0 && t[campo] < 1)
      .sort((a, b) => Math.abs(a[campo] - 0.5) - Math.abs(b[campo] - 0.5))[0];

  const cartoes = [
    { rotulo: "Favorito ao título", item: favorito, campo: "titulo", complemento: "de chance de título" },
    { rotulo: "G4 em aberto", item: maisAberto("g4"), campo: "g4", complemento: "de chance de G4" },
    { rotulo: "Na corda bamba", item: maisAberto("rebaixamento"), campo: "rebaixamento", complemento: "de chance de cair" },
  ];

  return cartoes
    .filter((c) => c.item)   // pula um destaque se não houver time para ele
    .map((c) => cartaoDestaque({
      rotulo: c.rotulo, time: times[c.item.id], valor: c.item[c.campo], complemento: c.complemento,
    }))
    .join("");
}

// As lojas de ingressos de cada clube (data/ingressos.json), lidas uma vez.
let ingressos = null;
// Um "despertador" por lista: redesenha os cartões na hora em que um jogo começa (o botão
// de ingressos some). Sem ele, o botão só sumiria quando a página fosse aberta de novo.
const despertadores = new Map();

// Onde fica a lista de jogos do dia de cada campeonato, e como ele é chamado nas frases.
const SERIE_A = { lista: "jogos-do-dia", data: "jogos-do-dia-data", nome: "o Brasileirão", doNome: "do Brasileirão", notas: true };
const SERIE_B = { lista: "jogos-serie-b-lista", data: "jogos-serie-b-data", nome: "a Série B", doNome: "da Série B", notas: false };

// Os jogos do dia da Série B. Se os dados dela não vierem, a parte da Série B só não aparece.
async function iniciarSerieB() {
  try {
    const dadosB = await carregarDados("serie-b");
    const { aoVivo } = await atualizarComEspn(dadosB.jogos);
    document.getElementById("jogos-serie-b").hidden = false;
    montarJogosDoDia(dadosB, aoVivo, SERIE_B);
    acompanharJogosDoDia(dadosB, SERIE_B);
  } catch (erro) {
    console.warn("Não consegui carregar os jogos da Série B.", erro);
  }
}

// Enquanto houver jogo rolando, busca o placar ao vivo de novo a cada minuto (direto da
// ESPN, pelo navegador de quem está vendo a página). Quando um jogo acaba, "aoAcabarUmJogo"
// (se houver) refaz a tabela.
const UM_MINUTO = 60 * 1000;

function acompanharJogosDoDia(dados, onde, aoAcabarUmJogo) {
  const relogio = setInterval(async () => {
    if (!temJogoRolando(todosOsJogos(dados.jogos))) {
      clearInterval(relogio);   // acabaram os jogos de agora: para de buscar
      return;
    }
    const { aoVivo, novos } = await atualizarComEspn(dados.jogos);
    if (novos > 0 && aoAcabarUmJogo) aoAcabarUmJogo();   // algum jogo acabou agora: tabela e chances novas
    montarJogosDoDia(dados, aoVivo, onde);
  }, UM_MINUTO);
}

// Os jogos da fase de pontos corridos mais os do playoff (que só existem na Série B).
function todosOsJogos(jogos) {
  return [...jogos.jogos, ...(jogos.playoff ?? [])];
}

// A seção "Jogos do dia": os jogos de hoje (ou, se hoje não tiver, os do próximo dia com jogo),
// cada um com as chances do modelo, a fase dos times, o placar (se a bola já rolou) e onde assistir.
//   onde: SERIE_A ou SERIE_B (a lista em que os jogos entram e o nome do campeonato)
function montarJogosDoDia({ jogos, modelo }, aoVivo, onde) {
  const lista = document.getElementById(onde.lista);
  const titulo = document.getElementById(onde.data);
  const agora = new Date();
  const escolha = escolherJogosDoDia(todosOsJogos(jogos), agora);
  if (!escolha) {
    titulo.textContent = "";
    lista.innerHTML = mensagem(`${onde.nome[0].toUpperCase()}${onde.nome.slice(1)} terminou: não há mais jogos.`, "carregando");
    return;
  }

  // "quinta-feira, 5 de novembro"
  const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${escolha.dia}T12:00:00Z`));
  const quantos = escolha.jogos.length === 1 ? "1 jogo" : `${escolha.jogos.length} jogos`;
  titulo.textContent = escolha.eHoje
    ? `Hoje, ${dataPorExtenso} · ${quantos}`
    : `Hoje não tem jogo ${onde.doNome}. Próximo dia de jogos: ${dataPorExtenso} · ${quantos}`;

  const tabela = new Map(tabelaAtual(jogos).map((linha) => [linha.id, linha]));
  lista.innerHTML = escolha.jogos.map((jogo) => cardConfronto({
    jogo,
    times: jogos.times,
    tabela,
    forma: { mandante: formaRecente(jogos.jogos, jogo.mandante), visitante: formaRecente(jogos.jogos, jogo.visitante) },
    chances: chancesDoJogo(jogo, modelo),
    estado: situacaoComPlacar(jogo, aoVivo, agora),
    ingresso: enderecoDoIngresso(jogo, ingressos, agora),
  })).join("");

  // Na hora em que o próximo destes jogos começar, redesenha (o botão de ingressos some).
  clearTimeout(despertadores.get(onde));
  const espera = msAteOProximoInicio(escolha.jogos, agora);
  if (espera !== null && espera < 24 * 60 * 60 * 1000) {
    despertadores.set(onde, setTimeout(() => montarJogosDoDia({ jogos, modelo }, aoVivo, onde), espera + 1000));
  }

  if (!onde.notas) return;   // a legenda e a nota ficam só embaixo dos jogos da Série A
  document.getElementById("jogos-do-dia-legenda").innerHTML = legendaResultado("mandante", "visitante");
  document.getElementById("jogos-do-dia-nota").textContent =
    "As chances de cada jogo vêm do mesmo modelo das simulações (ataque e defesa de cada time, mais o fator casa). " +
    "Os quadradinhos mostram os últimos 5 jogos de cada time (V = vitória, E = empate, D = derrota), do mais antigo ao mais recente. " +
    "Onde assistir: canais informados pelo ge.globo; podem mudar." +
    (aoVivo?.jogos && Object.keys(aoVivo.jogos).length
      ? ` Placar ao vivo da ESPN (último: ${new Intl.DateTimeFormat("pt-BR",
        { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(aoVivo.atualizado_em))}).`
      : "");
}

function mostrarErro(erro) {
  console.error(erro);
  lista.innerHTML = mensagem(
    `<strong>Não consegui carregar os dados.</strong><br>
     Se você abriu o arquivo com dois cliques, o navegador bloqueia a leitura dos dados.
     Abra pelo servidor local: na pasta do projeto, rode
     <code>python scripts/servidor_local.py</code> e acesse
     <code>http://localhost:8000/site/</code>.`,
    "erro");
}
