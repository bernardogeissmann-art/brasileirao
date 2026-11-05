// estadual.js
// O script das páginas dos campeonatos estaduais. O mesmo script serve para todos:
// a página diz qual campeonato mostrar em <body data-campeonato="...">.
//
// Ele lê três coisas da pasta data/estaduais/<campeonato>/:
//   jogos.json   (os jogos e os times)
//   chances.json (as chances de cada time em cada momento, já calculadas)
// e monta: os destaques, o gráfico da evolução das chances e a tabela de cada momento.

import {
  instalarCabecalho, montarRodape, cardTime, cartaoDestaque, legendaCategorias, mensagem, escaparHtml, formatarData,
} from "./componentes.js";
import { tabelaDoGrupo } from "./estaduais/motor.js";
import { FORMATOS } from "./estaduais/formatos.js";
import { desenharGraficoLinhas } from "./grafico-linhas.js";

const idCampeonato = document.body.dataset.campeonato;
const formato = FORMATOS[idCampeonato];

// Cor da linha do gráfico conforme o que está sendo mostrado.
const CORES = {
  titulo: "var(--cor-titulo)",
  rebaixamento: "var(--cor-rebaixamento)",
  copa: "var(--cor-sulamericana)",
  avanco: "var(--cor-tinta)",
};

const $ = (id) => document.getElementById(id);   // atalho para achar elementos pelo id
const grafico = $("grafico");
const trilho = $("momento-trilho");

instalarCabecalho($("topo"), formato.aba);
$("rodape").innerHTML = montarRodape(null);
$("legenda").innerHTML = legendaCategorias(formato.resultados);
$("regras").innerHTML = formato.regras.map((r) => `<li>${escaparHtml(r)}</li>`).join("");
$("grupos").innerHTML = `<ol class="lista-times">${mensagem("Carregando…", "carregando")}</ol>`;

let dados = null;
let chances = null;
const estado = { momento: 0, metrica: "titulo", destaque: null };

iniciar();


// ---------------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------------

async function baixarJson(arquivo) {
  const endereco = new URL(`../../data/estaduais/${idCampeonato}/${arquivo}`, import.meta.url);
  const resposta = await fetch(endereco);
  if (!resposta.ok) throw new Error(`Não consegui ler ${endereco} (erro ${resposta.status})`);
  return resposta.json();
}

async function iniciar() {
  try {
    [dados, chances] = await Promise.all([baixarJson("jogos.json"), baixarJson("chances.json")]);
  } catch (erro) {
    console.error(erro);
    $("grupos").innerHTML = `<ol class="lista-times">${mensagem(
      `<strong>Não consegui carregar os dados.</strong><br>Abra o site pelo servidor local:
       <code>python -m http.server 8000 --bind 127.0.0.1</code>.`, "erro")}</ol>`;
    return;
  }
  $("rodape").innerHTML = montarRodape(dados.baixado_em);

  const ultimo = chances.momentos.length - 1;
  estado.momento = ultimo;
  const campeao = idDoCampeao();
  estado.destaque = campeao ?? maisProvavel(ultimo, "titulo");

  montarAbertura(campeao);
  montarControles();
  trilho.max = String(ultimo);
  trilho.value = String(ultimo);
  desenharGrafico();
  desenharMomento();

  // Redesenha o gráfico quando a largura da tela muda (ex.: girar o celular).
  let larguraAnterior = grafico.clientWidth;
  new ResizeObserver(() => {
    if (grafico.clientWidth !== larguraAnterior) {
      larguraAnterior = grafico.clientWidth;
      desenharGrafico();
    }
  }).observe(grafico);
}


// ---------------------------------------------------------------------------
// AJUDANTES
// ---------------------------------------------------------------------------

const nome = (id) => dados.times[id].nome;
const minuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

// O campeão (só existe quando o campeonato terminou: chance de título de 100% no fim).
function idDoCampeao() {
  const fim = chances.momentos[chances.momentos.length - 1];
  return Object.keys(fim.times).find((id) => fim.times[id].titulo === 1) ?? null;
}

function maisProvavel(indice, campo) {
  const times = chances.momentos[indice].times;
  return Object.keys(times).sort((a, b) => times[b][campo] - times[a][campo])[0];
}

// Entre os momentos indicados, onde um valor foi menor (ou maior): devolve { valor, momento }.
function extremo(id, campo, momentos, maior) {
  let melhor = null;
  for (const m of momentos) {
    const v = m.times[id][campo];
    if (melhor === null || (maior ? v > melhor.valor : v < melhor.valor)) melhor = { valor: v, momento: m };
  }
  return melhor;
}


// ---------------------------------------------------------------------------
// ABERTURA E DESTAQUES
// ---------------------------------------------------------------------------

function montarAbertura(campeao) {
  const n = chances.simulacoes.toLocaleString("pt-BR");
  const ultimo = chances.momentos[chances.momentos.length - 1];
  // Os momentos "do meio": nem o início (ninguém sabia nada) nem o fim (já decidido).
  const meio = chances.momentos.filter((m) => m.id !== "inicio" && m !== ultimo);
  let cartoes;

  if (campeao) {
    $("chapeu").textContent = `${dados.competicao} · ${dados.temporada} · encerrado`;
    $("resumo").textContent = `O ${nome(campeao)} foi o campeão. Veja como as chances de cada time mudaram ` +
      `rodada a rodada, com ${n} simulações em cada momento.`;

    const pior = extremo(campeao, "titulo", meio, false);
    const rivais = Object.keys(dados.times).filter((id) => id !== campeao)
      .map((id) => ({ id, ...extremo(id, "titulo", meio, true) }))
      .sort((a, b) => b.valor - a.valor);
    const rebaixados = Object.keys(ultimo.times).filter((id) => ultimo.times[id].rebaixamento === 1)
      .map((id) => ({ id, ...extremo(id, "rebaixamento", meio, false) }))
      .sort((a, b) => a.valor - b.valor);

    cartoes = [
      { rotulo: "Campeão", id: campeao, valor: pior.valor,
        complemento: `de chance de título ${minuscula(pior.momento.rotulo)}` },
      { rotulo: "Bateu na trave", id: rivais[0].id, valor: rivais[0].valor,
        complemento: `de chance de título ${minuscula(rivais[0].momento.rotulo)}` },
      rebaixados[0] && { rotulo: "Caiu sem esperar", id: rebaixados[0].id, valor: rebaixados[0].valor,
        complemento: `de risco de queda ${minuscula(rebaixados[0].momento.rotulo)}` },
    ];
  } else {
    // Campeonato em andamento (o caso de 2027): mostra o momento atual.
    const agora = chances.momentos.length - 1;
    const atual = chances.momentos[agora].times;
    const ameacado = maisProvavel(agora, "rebaixamento");
    const disputado = Object.keys(atual).filter((id) => atual[id].quartas > 0 && atual[id].quartas < 1)
      .sort((a, b) => Math.abs(atual[a].quartas - 0.5) - Math.abs(atual[b].quartas - 0.5))[0];
    $("chapeu").textContent = `${dados.competicao} · ${dados.temporada} · em andamento`;
    $("resumo").textContent = `As chances de cada time, com ${n} simulações do que falta do campeonato.`;
    const favorito = maisProvavel(agora, "titulo");
    cartoes = [
      { rotulo: "Favorito ao título", id: favorito, valor: atual[favorito].titulo, complemento: "de chance de título" },
      disputado && { rotulo: "Briga pelas quartas", id: disputado, valor: atual[disputado].quartas, complemento: "de chance de ir às quartas" },
      { rotulo: "Mais perto da queda", id: ameacado, valor: atual[ameacado].rebaixamento, complemento: "de risco de queda" },
    ];
  }

  $("destaques").innerHTML = cartoes.filter(Boolean)
    .map((c) => cartaoDestaque({ rotulo: c.rotulo, time: dados.times[c.id], valor: c.valor, complemento: c.complemento }))
    .join("");
}


// ---------------------------------------------------------------------------
// GRÁFICO
// ---------------------------------------------------------------------------

function montarControles() {
  $("metricas").innerHTML = formato.resultados.map((r) =>
    `<button type="button" class="segmentado__botao" data-campo="${r.campo}" aria-pressed="${r.campo === estado.metrica}">${escaparHtml(r.rotulo)}</button>`).join("");
  $("metricas").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-campo]");
    if (!botao) return;
    estado.metrica = botao.dataset.campo;
    for (const b of $("metricas").children) b.setAttribute("aria-pressed", String(b === botao));
    desenharGrafico();
  });

  const ordenados = Object.keys(dados.times).sort((a, b) => nome(a).localeCompare(nome(b)));
  $("time-destaque").innerHTML = ordenados.map((id) => `<option value="${id}">${escaparHtml(nome(id))}</option>`).join("");
  $("time-destaque").value = estado.destaque;
  $("time-destaque").addEventListener("change", (evento) => escolherDestaque(evento.target.value));

  trilho.addEventListener("input", () => mudarMomento(Number(trilho.value)));
  $("momento-anterior").addEventListener("click", () => mudarMomento(estado.momento - 1));
  $("momento-proximo").addEventListener("click", () => mudarMomento(estado.momento + 1));
}

function escolherDestaque(id) {
  estado.destaque = id;
  $("time-destaque").value = id;
  desenharGrafico();
}

function desenharGrafico() {
  const campo = estado.metrica;
  const resultado = formato.resultados.find((r) => r.campo === campo);
  desenharGraficoLinhas(grafico, {
    rotulos: chances.momentos.map((m) => m.curto),
    titulos: chances.momentos.map((m) => m.rotulo),
    series: Object.keys(dados.times).map((id) => ({
      id, nome: nome(id), valores: chances.momentos.map((m) => m.times[id][campo]),
    })),
    destaque: estado.destaque,
    cor: CORES[resultado.classe],
    marcado: estado.momento,
    aoEscolher: escolherDestaque,
  });
}


// ---------------------------------------------------------------------------
// TABELA DE CADA MOMENTO
// ---------------------------------------------------------------------------

function mudarMomento(indice) {
  estado.momento = Math.max(0, Math.min(chances.momentos.length - 1, indice));
  trilho.value = String(estado.momento);
  desenharMomento();
  desenharGrafico();   // para mover a faixa que marca o momento no gráfico
}

function desenharMomento() {
  const momento = chances.momentos[estado.momento];
  const data = momento.ate ? formatarData(momento.ate).split(" às ")[0] : "";
  $("momento-rotulo").innerHTML = `${escaparHtml(momento.rotulo)}${data ? `<small>${data}</small>` : ""}`;
  $("momento-anterior").disabled = estado.momento === 0;
  $("momento-proximo").disabled = estado.momento === chances.momentos.length - 1;

  const grupos = [...new Set(Object.values(dados.times).map((t) => t.grupo))].sort();
  $("grupos").innerHTML = grupos.map((grupo) => {
    const tabela = tabelaDoGrupo(dados, momento, grupo);
    const cards = tabela.map((linha) => cardTime({
      linha,
      time: dados.times[linha.id],
      chances: momento.times[linha.id],
      categorias: formato.resultados,
      zona: formato.zona(linha.posicao),
    })).join("");
    return `
      <section class="grupo" aria-label="Grupo ${grupo}">
        <h3 class="grupo__titulo">Grupo ${grupo}</h3>
        <div class="tabela-chances"><ol class="lista-times lista-times--varias">${cards}</ol></div>
      </section>`;
  }).join("");
}
