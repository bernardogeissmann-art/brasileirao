// inicio.js
// O script da página principal. Ele:
//   1) desenha o topo e o rodapé;
//   2) carrega os dados (jogos.json e modelo.json);
//   3) roda as 10.000 simulações no navegador;
//   4) monta os destaques e a lista de times com as chances;
//   5) monta a seção "Jogos do dia", no fim da página.

import { carregarDados, simular, tabelaAtual, chancesDoJogo, N_SIMULACOES_PADRAO } from "./simulacao.js";
import {
  instalarCabecalho, montarRodape, cardTime, cartaoDestaque, mensagem, legendaCategorias, cabecalhoColunas,
  cardConfronto, legendaResultado,
} from "./componentes.js";
import { escolherJogosDoDia, formaRecente, situacaoDoJogo } from "./jogos-do-dia.js";

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

  const { jogos } = dados;
  const restantes = jogos.jogos.filter((jogo) => !jogo.disputado).length;
  chapeu.textContent = `Brasileirão Série A ${jogos.temporada} · faltam ${restantes} de ${jogos.jogos.length} jogos`;
  rodape.innerHTML = montarRodape(jogos.baixado_em);
  montarJogosDoDia(dados);   // não depende da simulação: aparece logo

  // Dá um instante para o navegador desenhar a mensagem "Simulando..." antes da conta pesada.
  await new Promise((pronto) => setTimeout(pronto, 30));

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

// A seção "Jogos do dia": os jogos de hoje (ou, se hoje não tiver, os do próximo dia com jogo),
// cada um com as chances do modelo, a fase dos times e onde assistir.
function montarJogosDoDia({ jogos, modelo }) {
  const lista = document.getElementById("jogos-do-dia");
  const titulo = document.getElementById("jogos-do-dia-data");
  const agora = new Date();
  const escolha = escolherJogosDoDia(jogos.jogos, agora);
  if (!escolha) {
    titulo.textContent = "";
    lista.innerHTML = mensagem("O Brasileirão terminou: não há mais jogos.", "carregando");
    return;
  }

  // "quinta-feira, 5 de novembro"
  const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${escolha.dia}T12:00:00Z`));
  const quantos = escolha.jogos.length === 1 ? "1 jogo" : `${escolha.jogos.length} jogos`;
  titulo.textContent = escolha.eHoje
    ? `Hoje, ${dataPorExtenso} · ${quantos}`
    : `Hoje não tem jogo do Brasileirão. Próximo dia de jogos: ${dataPorExtenso} · ${quantos}`;

  const tabela = new Map(tabelaAtual(jogos).map((linha) => [linha.id, linha]));
  lista.innerHTML = escolha.jogos.map((jogo) => cardConfronto({
    jogo,
    times: jogos.times,
    tabela,
    forma: { mandante: formaRecente(jogos.jogos, jogo.mandante), visitante: formaRecente(jogos.jogos, jogo.visitante) },
    chances: chancesDoJogo(jogo, modelo),
    situacao: situacaoDoJogo(jogo, agora),
  })).join("");

  document.getElementById("jogos-do-dia-legenda").innerHTML = legendaResultado("mandante", "visitante");
  document.getElementById("jogos-do-dia-nota").textContent =
    "As chances de cada jogo vêm do mesmo modelo das simulações (ataque e defesa de cada time, mais o fator casa). " +
    "Os quadradinhos mostram os últimos 5 jogos de cada time (V = vitória, E = empate, D = derrota), do mais antigo ao mais recente. " +
    "Onde assistir: canais informados pelo ge.globo na atualização da madrugada; podem mudar.";
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
