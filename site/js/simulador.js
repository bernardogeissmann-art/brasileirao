// simulador.js
// O script da página do simulador. Ele:
//   1) mostra os jogos que faltam, agrupados por rodada, com campos de placar;
//   2) a cada palpite, redesenha a tabela na hora (pontos, posições);
//   3) pede ao "ajudante" (Web Worker) para recalcular as chances sem travar a página;
//   4) mostra quanto cada chance mudou em relação ao cenário sem palpites.

import { carregarDados, tabelaAtual } from "./simulacao.js";
import {
  montarCabecalho, montarRodape, cardTime, mensagem, legendaCategorias, cabecalhoColunas, secaoRodada,
} from "./componentes.js";

// ---------------------------------------------------------------------------
// ELEMENTOS DA PÁGINA
// ---------------------------------------------------------------------------

const corpo = document.getElementById("corpo");
const rodadas = document.getElementById("rodadas");
const lista = document.getElementById("lista-times");
const contador = document.getElementById("contador");
const botaoLimparTudo = document.getElementById("limpar-tudo");
const estado = document.getElementById("estado");
const avisoTabela = document.getElementById("aviso-tabela");

document.getElementById("topo").innerHTML = montarCabecalho("simulador");
document.getElementById("rodape").innerHTML = montarRodape(null);
document.getElementById("legenda").innerHTML = legendaCategorias();
document.getElementById("cabecalho-colunas").innerHTML = cabecalhoColunas();
rodadas.innerHTML = `<ol class="lista-jogos">${mensagem("Carregando os jogos…", "carregando")}</ol>`;
lista.innerHTML = mensagem("Calculando as chances…", "carregando");


// ---------------------------------------------------------------------------
// ESTADO: o que o simulador sabe neste momento
// ---------------------------------------------------------------------------

let dados = null;
const palpites = new Map();        // id do jogo -> { gols_mandante, gols_visitante }
let versao = 0;                    // aumenta a cada mudança nos palpites
let versaoEnviada = -1;            // a versão que o ajudante está calculando (ou calculou)
let ocupado = false;               // o ajudante está no meio de uma conta?
let temporizador = null;
let semPalpites = null;            // resultado do cenário sem palpites (a base de comparação)
let calculado = null;              // resultado mais recente: { versao, resultado, milissegundos }

// Uma semente sorteada ao abrir a página. Todos os cálculos usam a mesma, então o
// cenário com palpites e o sem palpites usam os mesmos sorteios nos outros jogos.
const semente = Math.floor(Math.random() * 2 ** 31);

// O ajudante roda o arquivo trabalhador-simulacao.js separado da página.
const ajudante = new Worker(new URL("./trabalhador-simulacao.js", import.meta.url), { type: "module" });
ajudante.addEventListener("message", receberResultado);
ajudante.addEventListener("error", (erro) => {
  console.error(erro);
  estado.textContent = "Não consegui recalcular as chances neste navegador.";
});

iniciar();


// ---------------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------------

async function iniciar() {
  try {
    dados = await carregarDados();
  } catch (erro) {
    console.error(erro);
    const aviso = `<strong>Não consegui carregar os dados.</strong><br>
      Abra o site pelo servidor local: <code>python -m http.server 8000 --bind 127.0.0.1</code>
      e acesse <code>http://localhost:8000/site/simulador.html</code>.`;
    rodadas.innerHTML = `<ol class="lista-jogos">${mensagem(aviso, "erro")}</ol>`;
    lista.innerHTML = "";
    return;
  }

  document.getElementById("rodape").innerHTML = montarRodape(dados.jogos.baixado_em);
  desenharRodadas();
  ajudante.postMessage({ tipo: "dados", dados });
  pedirCalculo();          // o primeiro cálculo é o cenário sem palpites
  desenharTabela();
}

// Agrupa os jogos que faltam por rodada e desenha uma seção para cada rodada.
function desenharRodadas() {
  const porRodada = new Map();   // número da rodada -> lista de jogos
  for (const jogo of dados.jogos.jogos) {
    if (jogo.disputado) continue;
    if (!porRodada.has(jogo.rodada)) porRodada.set(jogo.rodada, []);
    porRodada.get(jogo.rodada).push(jogo);
  }
  const ordenadas = [...porRodada].sort((a, b) => a[0] - b[0]);
  rodadas.innerHTML = ordenadas
    .map(([rodada, jogos]) => secaoRodada(rodada, jogos, dados.jogos.times))
    .join("");
}


// ---------------------------------------------------------------------------
// PALPITES
// ---------------------------------------------------------------------------

// "input" acontece a cada tecla digitada em qualquer campo de placar.
// Um único "ouvinte" na lista toda atende todos os campos (mais simples que um por campo).
rodadas.addEventListener("input", (evento) => {
  const campo = evento.target;
  if (!campo.matches(".card-jogo__gols")) return;
  campo.value = campo.value.replace(/\D/g, "").slice(0, 2);   // só números, no máximo 2
  lerPalpite(campo.closest(".card-jogo"));
  aoMudarPalpites();
});

// Ao entrar num campo já preenchido, seleciona o número para ser fácil trocar.
rodadas.addEventListener("focusin", (evento) => {
  if (evento.target.matches(".card-jogo__gols")) evento.target.select();
});

// Botão "Limpar rodada" de cada rodada.
rodadas.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-limpar-rodada]");
  if (botao) limpar(botao.closest(".rodada"));
});

botaoLimparTudo.addEventListener("click", () => limpar(rodadas));

// Lê os dois campos de um jogo. Só vira palpite quando os dois lados estão preenchidos.
function lerPalpite(card) {
  const id = Number(card.dataset.id);
  const [campoMandante, campoVisitante] = card.querySelectorAll(".card-jogo__gols");
  const completo = campoMandante.value !== "" && campoVisitante.value !== "";
  const algum = campoMandante.value !== "" || campoVisitante.value !== "";

  if (completo) {
    palpites.set(id, { gols_mandante: Number(campoMandante.value), gols_visitante: Number(campoVisitante.value) });
  } else {
    palpites.delete(id);
  }
  card.classList.toggle("preenchido", completo);
  card.classList.toggle("incompleto", algum && !completo);
}

// Apaga os palpites de uma área (uma rodada ou todas).
function limpar(area) {
  for (const card of area.querySelectorAll(".card-jogo")) {
    for (const campo of card.querySelectorAll(".card-jogo__gols")) campo.value = "";
    lerPalpite(card);
  }
  aoMudarPalpites();
}

function listaFixados() {
  return [...palpites].map(([id, placar]) => ({ id, ...placar }));
}

function aoMudarPalpites() {
  versao++;
  atualizarControles();
  desenharTabela();              // pontos e posições mudam na hora
  // Espera 200 milésimos sem novas teclas antes de recalcular as chances,
  // para não refazer as contas a cada dígito.
  clearTimeout(temporizador);
  temporizador = setTimeout(pedirCalculo, 200);
}

// Atualiza o contador de palpites e os botões de limpar.
function atualizarControles() {
  const n = palpites.size;
  contador.textContent = n === 0 ? "Nenhum palpite" : n === 1 ? "1 palpite" : `${n} palpites`;
  botaoLimparTudo.disabled = n === 0;
  for (const secao of rodadas.querySelectorAll(".rodada")) {
    const temAlgo = secao.querySelector(".card-jogo.preenchido, .card-jogo.incompleto") !== null;
    secao.querySelector("[data-limpar-rodada]").hidden = !temAlgo;
  }
}


// ---------------------------------------------------------------------------
// CÁLCULO DAS CHANCES (conversa com o ajudante)
// ---------------------------------------------------------------------------

function pedirCalculo() {
  if (!dados || ocupado || versaoEnviada === versao) return;
  ocupado = true;
  versaoEnviada = versao;
  estado.textContent = "Recalculando as chances…";
  ajudante.postMessage({ tipo: "simular", versao, fixados: listaFixados(), semente });
}

function receberResultado(evento) {
  ocupado = false;
  const resposta = evento.data;
  if (resposta.versao === 0) semPalpites = resposta.resultado;   // o primeiro cálculo é a base
  calculado = resposta;

  // Os palpites mudaram enquanto o ajudante calculava? Então recalcula com os novos.
  if (resposta.versao !== versao) {
    pedirCalculo();
    return;
  }

  desenharTabela();
  const segundos = (resposta.milissegundos / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const n = palpites.size;
  estado.textContent = n === 0
    ? `Chances sem palpites · calculadas em ${segundos} s`
    : `Chances com ${n === 1 ? "1 palpite" : `${n} palpites`} · calculadas em ${segundos} s`;
  if (corpo.dataset.vista === "jogos" && n > 0) avisoTabela.hidden = false;
}


// ---------------------------------------------------------------------------
// TABELA
// ---------------------------------------------------------------------------

function desenharTabela() {
  if (!dados || !calculado) return;
  const tabela = tabelaAtual(dados.jogos, listaFixados());
  const chances = new Map(calculado.resultado.times.map((t) => [t.id, t]));
  const base = new Map(semPalpites.times.map((t) => [t.id, t]));
  const mostrarVariacao = palpites.size > 0;

  lista.innerHTML = tabela.map((linha) => cardTime({
    linha,
    time: dados.jogos.times[linha.id],
    chances: chances.get(linha.id),
    base: mostrarVariacao ? base.get(linha.id) : undefined,
  })).join("");

  // Enquanto as chances não correspondem aos palpites atuais, as barras ficam apagadas.
  lista.classList.toggle("recalculando", calculado.versao !== versao);
}


// ---------------------------------------------------------------------------
// ALTERNADOR (celular): mostra os jogos ou a tabela
// ---------------------------------------------------------------------------

for (const botao of document.querySelectorAll(".alternador__botao")) {
  botao.addEventListener("click", () => mudarVista(botao.dataset.ver));
}

function mudarVista(vista) {
  corpo.dataset.vista = vista;
  for (const botao of document.querySelectorAll(".alternador__botao")) {
    botao.setAttribute("aria-pressed", String(botao.dataset.ver === vista));
  }
  if (vista === "tabela") avisoTabela.hidden = true;
  // Se a página já estava rolada para baixo, volta para o começo dos painéis.
  if (corpo.getBoundingClientRect().top < 0) corpo.scrollIntoView();
}
