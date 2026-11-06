// meu-time.js
// O script da página Meu Time. Ele:
//   1) mostra a escolha do time (na primeira visita) e lembra a escolha neste navegador;
//   2) pinta a página com as cores do clube;
//   3) calcula as chances do time (mesma simulação do site, com os dados do dia);
//   4) monta a posição, os números da temporada e os últimos e próximos jogos;
//   5) mostra o texto "Situação atual" e as notícias, que são preparados às quartas e
//      aos domingos, às 23h (arquivo data/meu-time.json);
//   6) mostra os últimos vídeos de canais do YouTube dedicados ao time (data/canais-youtube.json).

import { carregarDados, simular, tabelaAtual, chancesDoJogo } from "./simulacao.js";
import {
  instalarCabecalho, montarRodape, anelChance, escaparHtml, formatarChance, formatarData, formatarDataJogo,
} from "./componentes.js";

const $ = (id) => document.getElementById(id);
const CHAVE = "prob.meuTime";   // nome usado para guardar a escolha no navegador

instalarCabecalho($("topo"), "meu-time");
$("rodape").innerHTML = montarRodape(null);

let dados = null;           // jogos e modelo
let cores = {};             // cores de cada clube
let conteudo = null;        // texto e notícias (pode não existir ainda)
let canais = null;          // canais do YouTube de cada time (opcional)
let chances = null;         // resultado da simulação (calculado uma vez)
let tabela = null;          // tabela atual

iniciar();


// ---------------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------------

async function lerJson(caminho) {
  const resposta = await fetch(new URL(`../../${caminho}`, import.meta.url));
  if (!resposta.ok) throw new Error(`Não consegui ler ${caminho}`);
  return resposta.json();
}

async function iniciar() {
  try {
    [dados, { times: cores }] = await Promise.all([carregarDados(), lerJson("data/cores-times.json")]);
  } catch (erro) {
    console.error(erro);
    $("escolha").hidden = false;
    $("escolha-grade").innerHTML = `<li>Não consegui carregar os dados. Abra o site pelo servidor local:
      <code>python -m http.server 8000 --bind 127.0.0.1</code>.</li>`;
    return;
  }
  // O texto e as notícias são opcionais: se o arquivo ainda não existir, a página funciona sem eles.
  conteudo = await lerJson("data/meu-time.json").catch(() => null);
  canais = await lerJson("data/canais-youtube.json").catch(() => null);
  $("rodape").innerHTML = montarRodape(dados.jogos.baixado_em);
  tabela = tabelaAtual(dados.jogos);

  montarEscolha();
  $("trocar").addEventListener("click", mostrarEscolha);

  // Time pelo endereço (?time=flamengo) ou o que ficou guardado da última visita.
  const pedido = new URLSearchParams(location.search).get("time") ?? localStorage.getItem(CHAVE);
  if (pedido && dados.jogos.times[pedido]) mostrarTime(pedido);
  else mostrarEscolha();
}


// ---------------------------------------------------------------------------
// AJUDANTES
// ---------------------------------------------------------------------------

const time = (id) => dados.jogos.times[id];
const enderecoEscudo = (id) => new URL(`../../${time(id).escudo}`, import.meta.url);
const escudo = (id, classe, tamanho = 28) =>
  `<img class="${classe}" src="${enderecoEscudo(id)}" alt="" width="${tamanho}" height="${tamanho}">`;
const numero = (valor, casas = 1) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const formatoDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const tempoRelativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// "há 2 dias", "ontem", "há 5 horas"...
function haQuantoTempo(iso) {
  const horas = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (horas < 24) return tempoRelativo.format(-Math.max(1, Math.round(horas)), "hour");
  return tempoRelativo.format(-Math.round(horas / 24), "day");
}

// Os jogos do time, já do ponto de vista dele (gols pró, gols contra, resultado).
function jogosDoTime(id) {
  return dados.jogos.jogos
    .filter((j) => j.mandante === id || j.visitante === id)
    .map((j) => {
      const emCasa = j.mandante === id;
      const golsPro = emCasa ? j.gols_mandante : j.gols_visitante;
      const golsContra = emCasa ? j.gols_visitante : j.gols_mandante;
      return { ...j, emCasa, adversario: emCasa ? j.visitante : j.mandante, golsPro, golsContra,
        resultado: !j.disputado ? null : golsPro > golsContra ? "V" : golsPro === golsContra ? "E" : "D" };
    });
}


// ---------------------------------------------------------------------------
// ESCOLHA DO TIME
// ---------------------------------------------------------------------------

function montarEscolha() {
  const ids = Object.keys(dados.jogos.times).sort((a, b) => time(a).nome.localeCompare(time(b).nome));
  $("escolha-grade").innerHTML = ids.map((id) => `
    <li><button type="button" class="escolha__time" data-time="${id}">
      ${escudo(id, "", 34)}<span>${escaparHtml(time(id).nome)}</span></button></li>`).join("");
  $("escolha-grade").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-time]");
    if (botao) mostrarTime(botao.dataset.time);
  });
}

function mostrarEscolha() {
  $("pagina-time").hidden = true;
  $("escolha").hidden = false;
  document.title = "Meu Time · Prob.com";
  window.scrollTo(0, 0);
}


// ---------------------------------------------------------------------------
// PÁGINA DO TIME
// ---------------------------------------------------------------------------

function mostrarTime(id) {
  localStorage.setItem(CHAVE, id);
  history.replaceState(null, "", `?time=${id}`);   // o endereço passa a apontar para este time
  aplicarCores(id);
  $("escolha").hidden = true;
  $("pagina-time").hidden = false;
  document.title = `${time(id).nome} · Meu Time · Prob.com`;

  const linha = tabela.find((l) => l.id === id);
  $("capa-escudo").src = enderecoEscudo(id);
  $("capa-escudo").alt = `Escudo do ${time(id).nome}`;
  $("capa-nome").textContent = time(id).nome;
  $("capa-resumo").textContent = `${linha.posicao}º lugar · ${linha.pontos} pontos · ${linha.jogos} jogos`;

  montarSituacao(id);
  montarPosicao(id, linha);
  montarNumeros(id, linha);
  montarJogos(id);
  montarNoticias(id);
  montarVideos(id);
  window.scrollTo(0, 0);

  // As chances levam um instante para calcular: primeiro a página aparece, depois os anéis.
  $("chances").innerHTML = `<p class="bloco__nota">Calculando as chances…</p>`;
  setTimeout(() => montarChances(id), 30);
}

// As cores do clube viram variáveis do CSS (--time-1, --time-2...), usadas em toda a página.
function aplicarCores(id) {
  const c = cores[id] ?? {};
  const estilo = document.body.style;
  if (c.principal) estilo.setProperty("--time-1", c.principal);
  // Se a segunda cor do clube for branca, usamos um tom claro da primeira (branco some no branco).
  const secundaria = !c.secundaria || c.secundaria.toUpperCase() === "#FFFFFF"
    ? `color-mix(in srgb, ${c.principal} 30%, #ffffff)` : c.secundaria;
  estilo.setProperty("--time-2", secundaria);
  if (c.texto) estilo.setProperty("--time-texto", c.texto);
  if (c.grafico) estilo.setProperty("--time-grafico", c.grafico);
}

// A) Situação atual: o texto preparado às quartas e aos domingos.
function montarSituacao(id) {
  const doTime = conteudo?.times?.[id];
  if (doTime) {
    $("situacao-texto").textContent = doTime.texto;
    // Quando o texto foi escrito por inteligência artificial, a página avisa.
    const autoria = doTime.autor === "ia"
      ? "Texto escrito por inteligência artificial (Claude, da Anthropic) com os números do site e as notícias abaixo; pode conter imprecisões. "
      : "";
    $("situacao-data").textContent = `${autoria}Atualizado em ${formatarData(conteudo.gerado_em)}; ` +
      "renovado às quartas e aos domingos, às 23h.";
  } else {
    $("situacao-texto").textContent = "O texto deste time sai na próxima atualização, na quarta ou no domingo, às 23h.";
    $("situacao-data").textContent = "";
  }
}

// B) As chances (anéis).
function montarChances(id) {
  chances ??= new Map(simular(dados).times.map((t) => [t.id, t]));   // calcula só na primeira vez
  const c = chances.get(id);
  const cor = "var(--time-grafico)";
  $("chances").innerHTML = [
    anelChance({ rotulo: "Título", valor: c.titulo, cor }),
    anelChance({ rotulo: "Libertadores", valor: c.libertadores, cor }),
    anelChance({ rotulo: "Sul-Americana", valor: c.sulamericana, cor }),
    // Rebaixamento sempre em vermelho, para não ser confundido com uma coisa boa.
    anelChance({ rotulo: "Rebaixamento", valor: c.rebaixamento, cor: "var(--cor-rebaixamento)" }),
  ].join("");
}

// B) Posição: número grande e os times em volta na tabela.
function montarPosicao(id, linha) {
  const i = linha.posicao - 1;
  const inicio = Math.max(0, Math.min(i - 2, tabela.length - 5));
  const vizinhos = tabela.slice(inicio, inicio + 5);
  $("posicao").innerHTML = `
    <div class="posicao">
      <p class="posicao__numero">${linha.posicao}º<small>${linha.pontos} pontos</small></p>
      <ol class="mini-tabela" aria-label="Times perto na tabela">
        ${vizinhos.map((l) => `
          <li class="${l.id === id ? "eu" : ""}">
            <span>${l.posicao}º</span>${escudo(l.id, "", 22)}
            <span>${escaparHtml(time(l.id).nome)}</span><span>${l.pontos} pts</span>
          </li>`).join("")}
      </ol>
    </div>`;
}

// B) Números da temporada.
function montarNumeros(id, linha) {
  const jogos = jogosDoTime(id).filter((j) => j.disputado);
  const n = jogos.length;
  const contar = (r) => jogos.filter((j) => j.resultado === r).length;
  const pontosDe = (lista) => lista.reduce((s, j) => s + (j.resultado === "V" ? 3 : j.resultado === "E" ? 1 : 0), 0);
  const gp = jogos.reduce((s, j) => s + j.golsPro, 0);
  const gc = jogos.reduce((s, j) => s + j.golsContra, 0);

  // Ranking de ataque e defesa pelo modelo (1º = melhor).
  const forcas = Object.entries(dados.modelo.times);
  const rankAtaque = forcas.sort((a, b) => b[1].ataque - a[1].ataque).findIndex(([t]) => t === id) + 1;
  const rankDefesa = forcas.sort((a, b) => a[1].defesa - b[1].defesa).findIndex(([t]) => t === id) + 1;

  const itens = [
    ["Aproveitamento", `${Math.round((100 * linha.pontos) / (3 * Math.max(1, n)))}%`, `${contar("V")} V · ${contar("E")} E · ${contar("D")} D`],
    ["Sequência", sequencia(jogos), "nos jogos mais recentes"],
    ["Gols marcados", String(gp), `${numero(gp / Math.max(1, n))} por jogo`],
    ["Gols sofridos", String(gc), `${numero(gc / Math.max(1, n))} por jogo`],
    ["Em casa", `${pontosDe(jogos.filter((j) => j.emCasa))} pts`, `fora: ${pontosDe(jogos.filter((j) => !j.emCasa))} pts`],
    ["Força pelo modelo", `${rankAtaque}º ataque`, `${rankDefesa}ª melhor defesa`],
  ];
  $("numeros").innerHTML = itens.map(([rotulo, valor, detalhe]) =>
    `<div><dt>${rotulo}</dt><dd>${valor}<small>${detalhe}</small></dd></div>`).join("");
}

function sequencia(jogos) {
  const recentes = [...jogos].sort((a, b) => b.data.localeCompare(a.data));
  const contar = (condicao) => {
    let k = 0;
    while (k < recentes.length && condicao(recentes[k])) k++;
    return k;
  };
  const vitorias = contar((j) => j.resultado === "V");
  const invicto = contar((j) => j.resultado !== "D");
  const derrotas = contar((j) => j.resultado === "D");
  const semVencer = contar((j) => j.resultado !== "V");
  if (vitorias >= 2) return `${vitorias} vitórias seguidas`;
  if (invicto >= 2) return `${invicto} sem perder`;
  if (derrotas >= 2) return `${derrotas} derrotas seguidas`;
  if (semVencer >= 2) return `${semVencer} sem vencer`;
  return { V: "venceu o último", E: "empatou o último", D: "perdeu o último" }[recentes[0]?.resultado] ?? "–";
}

// B) Últimos 5 jogos e próximos 3.
function montarJogos(id) {
  const todos = jogosDoTime(id);
  const nomeResultado = { V: "Vitória", E: "Empate", D: "Derrota" };

  const ultimos = todos.filter((j) => j.disputado).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  $("ultimos").innerHTML = ultimos.map((j) => `
    <li class="jogo-mt">
      <span class="resultado resultado--${j.resultado}" title="${nomeResultado[j.resultado]}">${j.resultado}<span class="so-leitor"> (${nomeResultado[j.resultado]})</span></span>
      ${escudo(j.adversario, "jogo-mt__escudo")}
      <span class="jogo-mt__adversario">${escaparHtml(time(j.adversario).nome)}
        <span class="jogo-mt__detalhe">${j.emCasa ? "em casa" : "fora"} · ${formatoDiaMes.format(new Date(j.data))}</span></span>
      <span class="jogo-mt__placar">${j.golsPro} × ${j.golsContra}</span>
    </li>`).join("") || `<li class="bloco__nota">Nenhum jogo ainda.</li>`;

  const proximos = todos.filter((j) => !j.disputado).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
  $("proximos").innerHTML = proximos.map((j) => {
    const c = chancesDoJogo(j, dados.modelo);
    const v = j.emCasa ? c.vitoriaM : c.vitoriaV;
    const d = j.emCasa ? c.vitoriaV : c.vitoriaM;
    const [diaSemana, resto] = formatarDataJogo(j.data).split(" ");
    const local = `${j.emCasa ? "Casa" : "Fora"}${j.estadio ? ` – ${escaparHtml(j.estadio)}` : ""}`;
    return `
      <li class="jogo-mt">
        <span class="jogo-mt__data">${diaSemana}<br>${resto}</span>
        ${escudo(j.adversario, "jogo-mt__escudo")}
        <span class="jogo-mt__adversario">${escaparHtml(time(j.adversario).nome)}
          <span class="jogo-mt__detalhe">${local}</span></span>
        <span></span>
        <div class="jogo-mt__chances" aria-label="Chances: vitória ${formatarChance(v)}, empate ${formatarChance(c.empate)}, derrota ${formatarChance(d)}">
          <div class="mini-chances" aria-hidden="true">
            <span class="v" style="flex-grow:${v}"></span><span class="e" style="flex-grow:${c.empate}"></span><span class="d" style="flex-grow:${d}"></span>
          </div>
          <p class="mini-chances__texto" aria-hidden="true">Vitória ${formatarChance(v)} · Empate ${formatarChance(c.empate)} · Derrota ${formatarChance(d)}</p>
        </div>
      </li>`;
  }).join("") || `<li class="bloco__nota">A temporada do time no Brasileirão já terminou.</li>`;
}

// C) Notícias.
function montarNoticias(id) {
  const noticias = conteudo?.times?.[id]?.noticias ?? [];
  $("noticias").innerHTML = noticias.map((n) => `
    <li>
      <a class="noticia" href="${escaparHtml(n.link)}" target="_blank" rel="noopener noreferrer">
        <span class="noticia__veiculo">${escaparHtml(n.veiculo)}</span>
        <span class="noticia__titulo">${escaparHtml(n.titulo)}<span class="so-leitor"> (abre em outra aba)</span></span>
        <span class="noticia__data">${haQuantoTempo(n.data)}</span>
      </a>
    </li>`).join("") || `<li class="bloco__nota">As notícias deste time saem na próxima atualização.</li>`;
}

// D) Vídeos: uma caixa do YouTube para cada canal dedicado ao time. Cada caixa é o player
// do próprio YouTube tocando a lista "vídeos do canal", que o YouTube mantém sempre com os
// mais recentes: o site não guarda vídeo nenhum. Uma entrada do tipo "destaque" toca um
// vídeo avulso (ex.: um vídeo sobre o time num canal que fala de outros assuntos).
// O endereço youtube-nocookie.com é o "modo de privacidade reforçada" do YouTube (não grava
// cookies de quem só abre a página). loading="lazy" faz o player só carregar quando a
// pessoa rola a página até ele.
const ROTULOS_VIDEO = { imprensa: "Imprensa dedicada", oficial: "Canal oficial", destaque: "Vídeo em destaque" };
const CODIGO_CANAL = /^UC[\w-]{22}$/;
const CODIGO_VIDEO = /^[\w-]{11}$/;

function montarVideos(id) {
  // Só entradas com código válido (um canal "UC..." ou um vídeo de 11 letras).
  const lista = (canais?.times?.[id] ?? []).filter((c) =>
    (c.tipo === "destaque" ? CODIGO_VIDEO.test(c.video ?? "") : CODIGO_CANAL.test(c.canal ?? "")));
  $("bloco-videos").hidden = lista.length === 0;
  $("videos").innerHTML = lista.map((c) => {
    const nome = escaparHtml(c.nome);
    let player;
    let link;
    if (c.tipo === "destaque") {
      player = `https://www.youtube-nocookie.com/embed/${c.video}`;
      link = { endereco: `https://www.youtube.com/watch?v=${c.video}`, texto: "Ver no YouTube" };
    } else {
      // A lista "UULF" + código do canal (sem o "UC") são os vídeos do canal, sem Shorts nem lives.
      player = `https://www.youtube-nocookie.com/embed/videoseries?list=UULF${c.canal.slice(2)}`;
      link = { endereco: `https://www.youtube.com/channel/${c.canal}/videos`, texto: "Ver o canal no YouTube" };
    }
    const titulo = c.titulo ? escaparHtml(c.titulo) : `Últimos vídeos de ${nome}`;
    return `
      <article class="video">
        <p class="video__topo">
          <strong class="video__nome">${nome}</strong>
          <span class="video__tipo">${ROTULOS_VIDEO[c.tipo] ?? ""}</span>
        </p>
        ${c.titulo ? `<p class="video__titulo">${titulo}</p>` : ""}
        <div class="video__tela">
          <iframe src="${player}" title="${titulo}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <a class="video__link" href="${link.endereco}" target="_blank" rel="noopener noreferrer">
          ${link.texto}<span aria-hidden="true"> ↗</span><span class="so-leitor"> (abre em outra aba)</span></a>
      </article>`;
  }).join("");
}
