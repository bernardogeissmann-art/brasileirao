// meu-time.js
// O script da página Meu Time. Ele:
//   1) mostra a escolha do time (na primeira visita) e lembra a escolha neste navegador;
//   2) pinta a página com as cores do clube;
//   3) calcula as chances do time (mesma simulação do site, com os dados do dia);
//   4) monta a posição, os números da temporada e os últimos e próximos jogos;
//   5) mostra o texto "Situação atual" e as notícias, que são preparados às quartas e
//      aos domingos, às 23h (arquivo data/meu-time.json);
//   6) mostra os últimos vídeos de canais do YouTube dedicados ao time (data/canais-youtube.json);
//   7) toca, ao vivo, as rádios que cobrem o time (data/radios.json).

import { lerIngressos, enderecoDoIngresso } from "./ingressos.js";
import { carregarDados, simular, tabelaAtual, chancesDoJogo } from "./simulacao.js";
import { atualizarComEspn } from "./jogos-do-dia.js";
import { brigasDoTime } from "./briga.js";
import { blocoBrigas } from "./componentes-briga.js";
import { entradaValida, listaDoYouTube, playerDaEntrada } from "./videos.js";
import {
  instalarCabecalho, montarRodape, anelChance, escaparHtml, formatarChance, formatarData, formatarDataJogo, botaoIngresso,
} from "./componentes.js";

const $ = (id) => document.getElementById(id);
const CHAVE = "prob.meuTime";   // nome usado para guardar a escolha no navegador

instalarCabecalho($("topo"), "meu-time");
$("rodape").innerHTML = montarRodape(null);

// Os dados de cada campeonato: { "serie-a": { dados, tabela, chances }, "serie-b": {...} }.
// A Série B é opcional: se os dados dela não carregarem, a página mostra só a Série A.
const campeonatos = {};
let campeonato = "serie-a";  // o campeonato do time que está na tela
let dados = null;           // jogos, modelo e ficha do campeonato do time que está na tela
let cores = {};             // cores de cada clube
let conteudo = null;        // texto e notícias (pode não existir ainda)
let canais = null;          // canais do YouTube de cada time (opcional)
let radios = null;          // rádios de cada time (opcional)
let ingressos = null;       // loja de ingressos de cada clube (opcional)
let tabela = null;          // tabela atual do campeonato do time que está na tela

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
    let dadosA;
    [dadosA, { times: cores }] = await Promise.all([carregarDados("serie-a"), lerJson("data/cores-times.json")]);
    await atualizarComEspn(dadosA.jogos);   // jogos que acabaram há pouco já entram com o placar final
    campeonatos["serie-a"] = { dados: dadosA, tabela: tabelaAtual(dadosA.jogos), chances: null };
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
  radios = await lerJson("data/radios.json").catch(() => null);
  ingressos = await lerIngressos();
  try {
    const dadosB = await carregarDados("serie-b");
    await atualizarComEspn(dadosB.jogos);
    campeonatos["serie-b"] = { dados: dadosB, tabela: tabelaAtual(dadosB.jogos), chances: null };
  } catch (erro) {
    console.warn("Não consegui carregar a Série B; a página mostra só a Série A.", erro);
  }
  $("rodape").innerHTML = montarRodape(campeonatos["serie-a"].dados.jogos.baixado_em);

  montarEscolha();
  $("trocar").addEventListener("click", mostrarEscolha);

  // Time pelo endereço (?time=flamengo) ou o que ficou guardado da última visita.
  const pedido = new URLSearchParams(location.search).get("time") ?? localStorage.getItem(CHAVE);
  if (pedido && campeonatoDoTime(pedido)) mostrarTime(pedido);
  else mostrarEscolha();
}

// Em que campeonato o time joga ("serie-a" ou "serie-b"), ou null se não for de nenhum.
function campeonatoDoTime(id) {
  return Object.keys(campeonatos).find((nome) => campeonatos[nome].dados.jogos.times[id]) ?? null;
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

// Duas partes: os times da Série A e, abaixo, os da Série B (se os dados dela carregaram).
function montarEscolha() {
  const grade = (nome) => {
    const times = campeonatos[nome].dados.jogos.times;
    const ids = Object.keys(times).sort((a, b) => times[a].nome.localeCompare(times[b].nome));
    return ids.map((id) => `
    <li><button type="button" class="escolha__time" data-time="${id}">
      <img src="${new URL(`../../${times[id].escudo}`, import.meta.url)}" alt="" width="34" height="34">
      <span>${escaparHtml(times[id].nome)}</span></button></li>`).join("");
  };
  $("escolha-grade").innerHTML = grade("serie-a");
  if (campeonatos["serie-b"]) {
    $("escolha-grade-b").innerHTML = grade("serie-b");
    $("escolha-grade-b").hidden = false;
    $("titulo-escolha-b").hidden = false;
  }
  $("escolha").addEventListener("click", (evento) => {
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
  // Passa a usar os dados do campeonato do time (Série A ou Série B).
  campeonato = campeonatoDoTime(id);
  ({ dados, tabela } = campeonatos[campeonato]);
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
  const naSerieB = campeonato === "serie-b" ? " na Série B" : "";
  $("capa-resumo").textContent = `${linha.posicao}º lugar${naSerieB} · ${linha.pontos} pontos · ${linha.jogos} jogos`;

  montarSituacao(id);
  montarPosicao(id, linha);
  montarNumeros(id, linha);
  montarJogos(id);
  montarNoticias(id);
  montarVideos(id);
  montarRadios(id);
  window.scrollTo(0, 0);

  // As chances levam um instante para calcular: primeiro a página aparece, depois os anéis.
  $("chances").innerHTML = `<p class="bloco__nota">Calculando as chances…</p>`;
  $("briga").hidden = true;
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
    $("situacao-data").textContent = `${autoria}Atualizado em ${formatarData(doTime.texto_em ?? conteudo.gerado_em)}.`;
  } else {
    $("situacao-texto").textContent = "O texto deste time sai depois do próximo jogo.";
    $("situacao-data").textContent = "";
  }
}

// B) As chances (anéis).
function montarChances(id) {
  const doCampeonato = campeonatos[campeonato];
  // Calcula só na primeira vez. "condicionais" pede também as chances conforme o resultado
  // do próximo jogo de cada time (usadas no bloco da reta final).
  doCampeonato.resultado ??= simular(dados, { condicionais: true });
  doCampeonato.chances ??= new Map(doCampeonato.resultado.times.map((t) => [t.id, t]));
  const c = doCampeonato.chances.get(id);
  montarBriga(id, doCampeonato.resultado);
  const cor = "var(--time-grafico)";
  if (campeonato === "serie-b") {
    // Série B: acesso (1º e 2º sobem direto; do 3º ao 6º, o playoff decide mais duas vagas).
    $("chances").innerHTML = [
      anelChance({ rotulo: "Título", valor: c.titulo, cor }),
      anelChance({ rotulo: "Acesso", valor: c.acesso, cor }),
      anelChance({ rotulo: "Playoff", valor: c.playoff, cor }),
      anelChance({ rotulo: "Rebaixamento", valor: c.rebaixamento, cor: "var(--cor-rebaixamento)" }),
    ].join("");
    return;
  }
  $("chances").innerHTML = [
    anelChance({ rotulo: "Título", valor: c.titulo, cor }),
    anelChance({ rotulo: "Libertadores", valor: c.libertadores, cor }),
    anelChance({ rotulo: "Sul-Americana", valor: c.sulamericana, cor }),
    // Rebaixamento sempre em vermelho, para não ser confundido com uma coisa boa.
    anelChance({ rotulo: "Rebaixamento", valor: c.rebaixamento, cor: "var(--cor-rebaixamento)" }),
  ].join("");
}

// Reta final: um bloco especial para os times numa briga (título, acesso ou rebaixamento),
// com um caminho para a página do campeonato. Os outros times não veem nada.
function montarBriga(id, resultado) {
  const brigas = brigasDoTime({
    id, campeonato, faixas: dados.config.faixas, resultado, tabela, jogos: dados.jogos.jogos,
  });
  $("briga").hidden = brigas.length === 0;
  if (brigas.length > 0) {
    $("briga").innerHTML = blocoBrigas(brigas, campeonato, dados.jogos.times, (rival) => escudo(rival, "", 24));
  }
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
  // Só o primeiro próximo jogo ganha o botão "Comprar ingressos" (e só até a hora do início).
  const ingressoDoProximo = proximos[0] ? enderecoDoIngresso(proximos[0], ingressos) : null;
  $("proximos").innerHTML = proximos.map((j, i) => {
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
        ${i === 0 && ingressoDoProximo ? `<div class="jogo-mt__ingresso">${botaoIngresso(ingressoDoProximo, time(j.mandante).nome)}</div>` : ""}
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

// D) Vídeos: uma caixa do YouTube para cada canal dedicado ao time. Cada caixa toca os vídeos
// mais recentes do canal guardados em data/meu-time.json (a lista só muda 20 horas depois de
// cada jogo do time); sem lista guardada, toca a lista do próprio YouTube. Uma entrada do tipo
// "destaque" toca um vídeo avulso. As regras ficam em videos.js. loading="lazy" faz o player
// só carregar quando a pessoa rola a página até ele.
const ROTULOS_VIDEO = { imprensa: "Imprensa dedicada", oficial: "Canal oficial", destaque: "Vídeo em destaque" };

function montarVideos(id) {
  const lista = (canais?.times?.[id] ?? []).filter(entradaValida);
  const guardados = conteudo?.times?.[id]?.videos ?? {};
  $("bloco-videos").hidden = lista.length === 0;
  $("videos").innerHTML = lista.map((c) => {
    const nome = escaparHtml(c.nome);
    const { player, link } = playerDaEntrada(c, guardados[listaDoYouTube(c)] ?? []);
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

// E) Rádios: um botão de tocar/parar para cada rádio que cobre o time. A transmissão é a da
// própria rádio (o endereço publicado pela RadiosNet, sempre com https). Um só tocador de
// áudio serve para todas: tocar uma rádio para a que estiver tocando.
// Algumas rádios (ex.: a Gaúcha) transmitem no formato HLS (.m3u8). O Safari toca esse formato
// sozinho; nos outros navegadores, carregamos na hora a biblioteca pública hls.js (só quando
// alguém clica numa rádio assim).
const HLS_JS = "https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.light.min.mjs";
const audio = $("radio-audio");
let radioTocando = null;   // a rádio que está tocando (ou null)
let tocadorHls = null;     // o ajudante do formato HLS, quando estiver em uso

$("radios").addEventListener("click", (evento) => {
  const botao = evento.target.closest(".radio__botao");
  if (!botao) return;
  const chave = botao.closest(".radio").dataset.radio;
  if (radioTocando === chave) pararRadio();
  else tocarRadio(chave);
});

function montarRadios(id) {
  pararRadio();   // trocou de time: para a rádio que estava tocando
  const lista = (radios?.times?.[id] ?? [])
    .map((chave) => ({ chave, ...radios.radios[chave] }))
    .filter((r) => r.nome && r.transmissao?.startsWith("https://"));
  $("bloco-radios").hidden = lista.length === 0;
  $("radios").innerHTML = lista.map((r) => `
    <li class="radio" data-radio="${escaparHtml(r.chave)}" data-estado="parado">
      <button type="button" class="radio__botao" aria-pressed="false" aria-label="Ouvir ${escaparHtml(r.nome)} ao vivo">
        <span class="radio__icone" aria-hidden="true"></span>
      </button>
      <span class="radio__texto">
        <strong class="radio__nome">${escaparHtml(r.nome)}</strong>
        <small class="radio__estado" aria-live="polite">${escaparHtml(r.cidade)}</small>
      </span>
      <a class="radio__link" href="${escaparHtml(r.pagina)}" target="_blank" rel="noopener noreferrer">
        RadiosNet<span aria-hidden="true"> ↗</span><span class="so-leitor"> (abre em outra aba)</span></a>
    </li>`).join("");
}

async function tocarRadio(chave) {
  pararRadio();
  const radio = radios.radios[chave];
  radioTocando = chave;
  marcarRadio(chave, "carregando");
  try {
    if (radio.transmissao.includes(".m3u8") && !audio.canPlayType("application/vnd.apple.mpegurl")) {
      const { default: Hls } = await import(HLS_JS);
      if (radioTocando !== chave) return;   // a pessoa já clicou em outra coisa
      tocadorHls = new Hls();
      tocadorHls.loadSource(radio.transmissao);
      tocadorHls.attachMedia(audio);
    } else {
      audio.src = radio.transmissao;
    }
    await audio.play();
    if (radioTocando === chave) marcarRadio(chave, "tocando");
  } catch (erro) {
    console.error(erro);
    if (radioTocando === chave) {
      marcarRadio(chave, "erro");
      radioTocando = null;
    }
  }
}

function pararRadio() {
  if (tocadorHls) {
    tocadorHls.destroy();
    tocadorHls = null;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();   // solta a conexão com a rádio
  if (radioTocando) marcarRadio(radioTocando, "parado");
  radioTocando = null;
}

// Mostra na tela o estado de uma rádio: parado, carregando, tocando ou erro.
function marcarRadio(chave, estado) {
  const item = document.querySelector(`.radio[data-radio="${chave}"]`);
  if (!item) return;
  const radio = radios.radios[chave];
  item.dataset.estado = estado;
  const ativo = estado === "tocando" || estado === "carregando";
  const botao = item.querySelector(".radio__botao");
  botao.setAttribute("aria-pressed", String(ativo));
  botao.setAttribute("aria-label", `${ativo ? "Parar" : "Ouvir"} ${radio.nome} ao vivo`);
  item.querySelector(".radio__estado").textContent = {
    parado: radio.cidade, carregando: "Conectando…", tocando: "Ao vivo", erro: "Não consegui tocar agora",
  }[estado];
}
