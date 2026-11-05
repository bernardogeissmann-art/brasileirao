// metodo.js
// O script da página "O Método". O texto da explicação fica no HTML; aqui só:
//   1) preenchemos os números de verdade do modelo (melhor ataque, fator casa...);
//   2) montamos o exemplo com um jogo escolhido na lista;
//   3) fazemos a demonstração de sorteios ("Experimente você mesmo").

import { carregarDados, chancesDoJogo, chancesAcumuladas, sortearGols } from "./simulacao.js";
import {
  instalarCabecalho, montarRodape, colunasGols, barraResultado, legendaResultado, formatarDataJogo, escaparHtml,
  formatarGols,
} from "./componentes.js";

instalarCabecalho(document.getElementById("topo"), "metodo");
document.getElementById("rodape").innerHTML = montarRodape(null);

const seletor = document.getElementById("jogo-exemplo");
const conta = document.getElementById("exemplo-conta");
const graficos = document.getElementById("exemplo-graficos");
const resultado = document.getElementById("exemplo-resultado");
const placar = document.getElementById("exemplo-placar");
const demoPlacar = document.getElementById("demo-placar");
const demoComparacao = document.getElementById("demo-comparacao");

let dados = null;
let jogoAtual = null;
let chancesAtuais = null;
// Estado da demonstração: quantos sorteios deram vitória de cada lado ou empate.
let demo = null;

iniciar();


// ---------------------------------------------------------------------------
// AJUDANTES
// ---------------------------------------------------------------------------

// Número no formato brasileiro, com vírgula: 1.364 -> "1,36".
function numero(valor, casas = 2) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function porcentagem(valor) {
  return `${Math.round(valor * 100)}%`;
}

// Coloca um texto em todos os elementos marcados com data-valor="nome".
function preencher(nome, texto) {
  for (const elemento of document.querySelectorAll(`[data-valor="${nome}"]`)) {
    elemento.textContent = texto;
  }
}


// ---------------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------------

async function iniciar() {
  try {
    dados = await carregarDados();
  } catch (erro) {
    console.error(erro);
    conta.innerHTML = `Não consegui carregar os dados. Abra o site pelo servidor local:
      <code>python -m http.server 8000 --bind 127.0.0.1</code>.`;
    return;
  }
  document.getElementById("rodape").innerHTML = montarRodape(dados.jogos.baixado_em);
  preencherNumeros();
  montarSeletor();
}

// Os números de verdade que aparecem no meio do texto.
function preencherNumeros() {
  const { modelo, jogos } = dados;
  const times = Object.values(modelo.times);
  const melhorAtaque = times.reduce((a, b) => (b.ataque > a.ataque ? b : a));
  const melhorDefesa = times.reduce((a, b) => (b.defesa < a.defesa ? b : a));   // menor = melhor

  preencher("ataque-valor", numero(melhorAtaque.ataque));
  preencher("ataque-time", melhorAtaque.nome);
  preencher("defesa-valor", numero(melhorDefesa.defesa));
  preencher("defesa-time", melhorDefesa.nome);
  preencher("fator-casa", numero(modelo.fator_casa));
  preencher("fator-casa-pct", `+${Math.round((modelo.fator_casa - 1) * 100)}%`);
  preencher("jogos-usados", String(modelo.jogos_usados));

  // Empates: quantos o modelo esperava nos jogos já disputados x quantos houve.
  const disputados = jogos.jogos.filter((jogo) => jogo.disputado);
  const esperados = disputados.reduce((soma, jogo) => soma + chancesDoJogo(jogo, modelo).empate, 0);
  const reais = disputados.filter((jogo) => jogo.gols_mandante === jogo.gols_visitante).length;
  preencher("empates-esperados", String(Math.round(esperados)));
  preencher("empates-reais", String(reais));
}

// A lista de jogos que faltam, agrupada por rodada. Começa no próximo jogo pela data.
function montarSeletor() {
  const { jogos } = dados;
  const restantes = jogos.jogos.filter((jogo) => !jogo.disputado);
  const porRodada = new Map();
  for (const jogo of restantes) {
    if (!porRodada.has(jogo.rodada)) porRodada.set(jogo.rodada, []);
    porRodada.get(jogo.rodada).push(jogo);
  }

  // <optgroup> agrupa as opções da lista sob um título (a rodada).
  seletor.innerHTML = [...porRodada].sort((a, b) => a[0] - b[0]).map(([rodada, lista]) => `
    <optgroup label="Rodada ${rodada}">
      ${lista.map((jogo) => `<option value="${jogo.id}">${escaparHtml(jogos.times[jogo.mandante].nome)} × ${escaparHtml(jogos.times[jogo.visitante].nome)} · ${formatarDataJogo(jogo.data)}</option>`).join("")}
    </optgroup>`).join("");

  const proximo = [...restantes].sort((a, b) => a.data.localeCompare(b.data))[0];
  seletor.value = String(proximo.id);
  seletor.addEventListener("change", () => mostrarExemplo(Number(seletor.value)));
  mostrarExemplo(proximo.id);
}


// ---------------------------------------------------------------------------
// O EXEMPLO (passos 2 e 3)
// ---------------------------------------------------------------------------

function mostrarExemplo(idJogo) {
  const { jogos, modelo } = dados;
  jogoAtual = jogos.jogos.find((jogo) => jogo.id === idJogo);
  chancesAtuais = chancesDoJogo(jogoAtual, modelo);
  const c = chancesAtuais;
  const mandante = jogos.times[jogoAtual.mandante];
  const visitante = jogos.times[jogoAtual.visitante];
  const forcaM = modelo.times[jogoAtual.mandante];
  const forcaV = modelo.times[jogoAtual.visitante];
  const gols = (media) => formatarGols(media, 2);

  // A conta do passo 2, com os números de verdade.
  conta.innerHTML = `
    <span class="exemplo__linha"><strong>${escaparHtml(mandante.nome)}</strong> (em casa):
      ${numero(forcaM.ataque)} × ${numero(forcaV.defesa)} × ${numero(modelo.fator_casa)} = <b>${gols(c.mediaM)}</b> em média</span>
    <span class="exemplo__linha"><strong>${escaparHtml(visitante.nome)}</strong>:
      ${numero(forcaV.ataque)} × ${numero(forcaM.defesa)} = <b>${gols(c.mediaV)}</b> em média</span>`;

  // Os gráficos do passo 3.
  graficos.innerHTML =
    colunasGols({ time: mandante, media: c.mediaM, chances: c.golsM }) +
    colunasGols({ time: visitante, media: c.mediaV, chances: c.golsV });

  resultado.innerHTML =
    barraResultado({ nomeMandante: mandante.nome, nomeVisitante: visitante.nome,
      vitoriaM: c.vitoriaM, empate: c.empate, vitoriaV: c.vitoriaV }) +
    legendaResultado(mandante.nome, visitante.nome);

  const p = c.placarMaisProvavel;
  placar.innerHTML = `O placar mais provável é <strong>${escaparHtml(mandante.nome)} ${p.gols_mandante} × ${p.gols_visitante}
    ${escaparHtml(visitante.nome)}</strong>, com ${porcentagem(p.chance)} de chance. Repare: mesmo o placar mais provável
    é pouco provável sozinho. Por isso falamos em chances, e não em previsões.`;

  zerarDemonstracao();
}


// ---------------------------------------------------------------------------
// A DEMONSTRAÇÃO DE SORTEIOS (passo 4)
// ---------------------------------------------------------------------------

document.getElementById("sortear-1").addEventListener("click", () => sortear(1));
document.getElementById("sortear-1000").addEventListener("click", () => sortear(1000));
document.getElementById("zerar").addEventListener("click", zerarDemonstracao);

function zerarDemonstracao() {
  if (!chancesAtuais) return;
  demo = {
    // As mesmas "roletas" de gols que a simulação usa.
    roletaM: chancesAcumuladas(chancesAtuais.mediaM),
    roletaV: chancesAcumuladas(chancesAtuais.mediaV),
    mandante: 0, empate: 0, visitante: 0, total: 0, ultimo: null,
  };
  desenharDemonstracao();
}

function sortear(vezes) {
  if (!demo) return;
  for (let i = 0; i < vezes; i++) {
    const golsM = sortearGols(demo.roletaM, Math.random);
    const golsV = sortearGols(demo.roletaV, Math.random);
    if (golsM > golsV) demo.mandante++;
    else if (golsM === golsV) demo.empate++;
    else demo.visitante++;
    demo.total++;
    demo.ultimo = [golsM, golsV];
  }
  desenharDemonstracao();
}

function desenharDemonstracao() {
  const { jogos } = dados;
  const nomeM = jogos.times[jogoAtual.mandante].nome;
  const nomeV = jogos.times[jogoAtual.visitante].nome;
  const c = chancesAtuais;

  if (demo.total === 0) {
    demoPlacar.innerHTML = `<span class="demonstracao__vazio">Nenhum sorteio ainda.</span>`;
  } else {
    const [gm, gv] = demo.ultimo;
    demoPlacar.innerHTML = `
      <span class="demonstracao__rotulo">Último placar sorteado</span>
      <span class="demonstracao__jogo">${escaparHtml(nomeM)} <b>${gm} × ${gv}</b> ${escaparHtml(nomeV)}</span>
      <span class="demonstracao__total">${demo.total.toLocaleString("pt-BR")} ${demo.total === 1 ? "sorteio" : "sorteios"} até agora</span>`;
  }

  const calculada = barraResultado({ nomeMandante: nomeM, nomeVisitante: nomeV,
    vitoriaM: c.vitoriaM, empate: c.empate, vitoriaV: c.vitoriaV, rotulo: "Chance calculada" });
  const sorteada = demo.total === 0 ? "" : barraResultado({ nomeMandante: nomeM, nomeVisitante: nomeV,
    vitoriaM: demo.mandante / demo.total, empate: demo.empate / demo.total, vitoriaV: demo.visitante / demo.total,
    rotulo: `Nos seus ${demo.total.toLocaleString("pt-BR")} ${demo.total === 1 ? "sorteio" : "sorteios"}` });

  demoComparacao.innerHTML = sorteada + calculada + legendaResultado(nomeM, nomeV);
}
