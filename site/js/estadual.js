// estadual.js
// O script das páginas dos campeonatos estaduais (e da Copa Sul-Americana). O mesmo script
// serve para todos: a página diz qual campeonato mostrar em <body data-campeonato="...">.
//
// Ele lê duas coisas da pasta data/estaduais/<campeonato>/ (as copas ficam em data/copas/):
//   jogos.json   (os jogos e os times)
//   chances.json (as chances de cada time em cada momento, já calculadas)
// e monta: os destaques, o gráfico da evolução das chances e a tabela de cada momento.
//
// Enquanto o mata-mata está rolando (ex.: a Sul-Americana antes da final), a página ganha a
// parte "Na disputa", só com os times que ainda podem ser campeões: um painel por confronto,
// com o próximo jogo, as chances, a campanha, o caminho até aqui e os vídeos de cada time.
// O gráfico e as tabelas (com todos os times) ficam embaixo, recolhidos, em "Como chegamos até aqui".

import {
  instalarCabecalho, montarRodape, cardTime, cartaoDestaque, legendaCategorias, mensagem, escaparHtml, formatarData,
} from "./componentes.js";
import { tabelaDoGrupo } from "./estaduais/motor.js";
import { FORMATOS } from "./estaduais/formatos.js";
import { desenharGraficoLinhas } from "./grafico-linhas.js";
import {
  mataMataEmAndamento, timesNaDisputa, confrontosAtuais, campanhaDoTime, caminhoDoTime, diasAte, DEPOIS_DA_FASE,
} from "./estaduais/mata-mata.js";
import { painelConfronto, painelSemAdversario, playerDeVideos } from "./componentes-duelo.js";
import { formaRecente, atualizarComEspn, situacaoComPlacar, temJogoRolando } from "./jogos-do-dia.js";
import { chancesDoJogo } from "./simulacao.js";
import { entradaValida, listaDoYouTube, playerDaEntrada } from "./videos.js";
import { lerIngressos, enderecoDoIngresso, msAteOProximoInicio } from "./ingressos.js";

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
  const pasta = formato.pasta ?? `data/estaduais/${idCampeonato}`;
  const endereco = new URL(`../../${pasta}/${arquivo}`, import.meta.url);
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
       <code>python scripts/servidor_local.py</code>.`, "erro")}</ol>`;
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
  // Mata-mata rolando: monta a parte "Na disputa" (o gráfico vai para o histórico, antes de ser desenhado).
  if (mataMataEmAndamento(dados, chances)) iniciarDisputa();   // sem "await": aparece quando os dados chegarem
  desenharGrafico();
  desenharMomento();

  // Redesenha o gráfico quando a largura da tela muda (ex.: girar o celular, ou abrir o
  // "Como chegamos até aqui", onde ele fica recolhido durante o mata-mata).
  let larguraAnterior = grafico.clientWidth;
  new ResizeObserver(() => {
    if (grafico.clientWidth > 0 && grafico.clientWidth !== larguraAnterior) {
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
    // Campeonato em andamento: mostra o momento atual.
    const agora = chances.momentos.length - 1;
    const atual = chances.momentos[agora].times;
    const temQueda = formato.resultados.some((r) => r.campo === "rebaixamento");
    const ameacado = temQueda ? maisProvavel(agora, "rebaixamento") : null;
    const disputado = Object.keys(atual).filter((id) => atual[id].quartas > 0 && atual[id].quartas < 1)
      .sort((a, b) => Math.abs(atual[a].quartas - 0.5) - Math.abs(atual[b].quartas - 0.5))[0];
    $("chapeu").textContent = `${dados.competicao} · ${dados.temporada} · em andamento`;
    $("resumo").textContent = `As chances de cada time, com ${n} simulações do que falta do campeonato.`;
    const [favorito, segundo] = Object.keys(atual).sort((a, b) => atual[b].titulo - atual[a].titulo);
    cartoes = [
      { rotulo: "Favorito ao título", id: favorito, valor: atual[favorito].titulo, complemento: "de chance de título" },
      // Sem rebaixamento (ex.: a Sul-Americana), o segundo cartão é o 2º favorito.
      !temQueda && atual[segundo].titulo > 0 && { rotulo: "Na cola", id: segundo, valor: atual[segundo].titulo, complemento: "de chance de título" },
      disputado && { rotulo: "Briga pelas quartas", id: disputado, valor: atual[disputado].quartas, complemento: "de chance de ir às quartas" },
      ameacado && { rotulo: "Mais perto da queda", id: ameacado, valor: atual[ameacado].rebaixamento, complemento: "de risco de queda" },
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

  // Cada grupo da 1ª fase vira um bloco com a sua tabela. Um campeonato de tabela única
  // (ex.: a fase de liga do Paulista 2026) é dividido em duas metades, para ficar lado a lado
  // na tela grande, do mesmo jeito que os grupos A e B dos outros estaduais.
  const grupos = [...new Set(Object.values(dados.times).map((t) => t.grupo))].sort();
  const blocos = [];
  for (const grupo of grupos) {
    // "De fora": times que não jogaram a 1ª fase (ex.: os que vieram da Libertadores para a
    // Sul-Americana). A tabela deles soma os jogos de todas as fases e não mostra posição.
    const deFora = formato.gruposDeFora?.[grupo];
    let tabela = tabelaDoGrupo(dados, momento, grupo, { conmebol: Boolean(formato.desempateConmebol), todasAsFases: Boolean(deFora) });
    if (deFora) tabela = tabela.map((linha) => ({ ...linha, posicao: "–", deFora: true }));
    const titulo = deFora ?? (formato.tituloGrupo ? formato.tituloGrupo(grupo) : `Grupo ${grupo}`);
    if (grupos.length === 1 && tabela.length > 8 && !deFora) {
      const metade = Math.ceil(tabela.length / 2);
      blocos.push({ titulo: `${titulo} · 1º ao ${metade}º`, linhas: tabela.slice(0, metade) });
      blocos.push({ titulo: `${titulo} · ${metade + 1}º ao ${tabela.length}º`, linhas: tabela.slice(metade) });
    } else {
      blocos.push({ titulo, linhas: tabela });
    }
  }

  $("grupos").innerHTML = blocos.map(({ titulo, linhas }) => {
    const cards = linhas.map((linha) => cardTime({
      linha,
      time: dados.times[linha.id],
      chances: momento.times[linha.id],
      categorias: formato.resultados,
      zona: linha.deFora ? "neutra" : formato.zona(linha.posicao),
    })).join("");
    return `
      <section class="grupo" aria-label="${escaparHtml(titulo)}">
        <h3 class="grupo__titulo">${escaparHtml(titulo)}</h3>
        <div class="tabela-chances"><ol class="lista-times lista-times--varias">${cards}</ol></div>
      </section>`;
  }).join("");
}


// ---------------------------------------------------------------------------
// NA DISPUTA (só enquanto o mata-mata está rolando)
// ---------------------------------------------------------------------------

// Lê um arquivo de data/ (ex.: as cores dos times); se falhar, devolve null e a página segue sem ele.
async function lerDoSite(caminho) {
  try {
    const resposta = await fetch(new URL(`../../${caminho}`, import.meta.url));
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

const disputa = {
  modelo: null, cores: {}, canais: {}, aoVivo: null, meuTime: null, ingressos: null,
  relogio: null,       // busca o placar ao vivo a cada minuto, enquanto há jogo rolando
  despertador: null,   // redesenha o painel na hora em que o próximo jogo começa
};

async function iniciarDisputa() {
  prepararPaginaDaDisputa();
  const [modelos, cores, canais, ingressos] = await Promise.all([
    baixarJson("modelos.json").catch(() => null), lerDoSite("data/cores-times.json"), lerDoSite("data/canais-youtube.json"),
    lerIngressos(),
  ]);
  const ultimoModelo = modelos?.momentos[modelos.momentos.length - 1];
  disputa.modelo = ultimoModelo ? { times: ultimoModelo.times, fator_casa: ultimoModelo.fator_casa } : null;
  disputa.cores = cores?.times ?? {};
  disputa.canais = canais?.times ?? {};
  disputa.ingressos = ingressos;
  // Placar ao vivo (só para os campeonatos que a ESPN cobre, como as copas). Um jogo que a
  // ESPN já dá como encerrado passa a contar como disputado (o painel mostra o resultado).
  if (dados.liga_espn) ({ aoVivo: disputa.aoVivo } = await atualizarComEspn(dados));
  desenharDisputa();
  acompanharAoVivo();
}

// Enquanto houver jogo rolando, busca o placar de novo a cada minuto (direto da ESPN, pelo
// navegador de quem está vendo a página). Sem jogo rolando, para; volta na hora do próximo jogo.
function acompanharAoVivo() {
  if (disputa.relogio || !dados.liga_espn || !temJogoRolando(dados.jogos)) return;
  disputa.relogio = setInterval(async () => {
    if (!temJogoRolando(dados.jogos)) {
      clearInterval(disputa.relogio);
      disputa.relogio = null;
      return;
    }
    ({ aoVivo: disputa.aoVivo } = await atualizarComEspn(dados));
    desenharDisputa();
  }, 60 * 1000);
}

// Põe a parte "Na disputa" logo depois da abertura e guarda o gráfico e a tabela de cada
// momento (que mostram todos os times) dentro de um "Como chegamos até aqui" recolhido.
function prepararPaginaDaDisputa() {
  const evolucao = $("titulo-evolucao").closest("section");
  const momento = $("titulo-momento").closest("section");
  const secao = document.createElement("section");
  secao.className = "estadual__secao disputa";
  secao.setAttribute("aria-labelledby", "titulo-disputa");
  secao.innerHTML = `
    <h2 class="titulo-secao" id="titulo-disputa">Na disputa</h2>
    <p class="estadual__texto" id="disputa-texto">Carregando…</p>
    <div class="disputa__confrontos" id="disputa-confrontos"></div>`;
  const historico = document.createElement("details");
  historico.className = "estadual__secao historico";
  historico.innerHTML = `
    <summary class="historico__resumo">
      Como chegamos até aqui
      <small>o gráfico das chances e os grupos em cada momento, com todos os times (também os que já caíram)</small>
    </summary>`;
  evolucao.before(secao);
  secao.after(historico);
  historico.append(evolucao, momento);

  // Os botões "Ver os vídeos": o player só é carregado quando a pessoa pede (deixa a página leve).
  $("disputa-confrontos").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-time]");
    if (botao) mostrarVideos(botao.dataset.time, botao.closest("[data-videos]"));
  });
}

// O canal do YouTube de um time (de data/canais-youtube.json): o oficial, se houver.
function canalDoTime(id) {
  const lista = (disputa.canais[id] ?? []).filter(entradaValida);
  return lista.find((c) => c.tipo === "oficial") ?? lista[0] ?? null;
}

async function mostrarVideos(id, lugar) {
  const canal = canalDoTime(id);
  if (!canal || !lugar) return;
  // Os vídeos guardados de cada time (os mesmos do Meu Time), lidos só na primeira vez.
  disputa.meuTime ??= await lerDoSite("data/meu-time.json");
  const guardados = disputa.meuTime?.times?.[id]?.videos ?? {};
  lugar.innerHTML = `<h4 class="duelo__subtitulo">Vídeos · ${escaparHtml(canal.nome)}</h4>` +
    playerDeVideos(playerDaEntrada(canal, guardados[listaDoYouTube(canal)] ?? []), dados.times[id].nome);
}

function desenharDisputa() {
  const fim = chances.momentos[chances.momentos.length - 1].times;
  const naDisputa = timesNaDisputa(chances);
  const { confrontos, semAdversario } = confrontosAtuais(dados, naDisputa);
  const agora = new Date();

  const nomes = naDisputa.map(nome);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0];
  $("disputa-texto").textContent = `Restam ${naDisputa.length} times: ${lista}. ` +
    "Os que já caíram ficam em \"Como chegamos até aqui\", mais abaixo.";

  const lado = (id, fase) => {
    const campo = DEPOIS_DA_FASE[fase];
    const temAvancar = campo && campo !== "titulo" && fim[id][campo] !== undefined;
    return {
      id,
      time: dados.times[id],
      cores: disputa.cores[id],
      titulo: fim[id].titulo,
      avancar: temAvancar ? { fase, valor: fim[id][campo] } : null,
      forma: formaRecente(dados.jogos, id),
      caminho: caminhoDoTime(dados, id, formato),
      campanha: campanhaDoTime(dados, id),
      temVideos: Boolean(canalDoTime(id)),
    };
  };

  const paineis = confrontos.map((confronto) => {
    const [a, b] = confronto.times;
    const proximo = confronto.proximo;
    return painelConfronto({
      confronto,
      ladoA: lado(a, confronto.fase),
      ladoB: lado(b, confronto.fase),
      chancesJogo: proximo && disputa.modelo ? chancesDoJogo(proximo, disputa.modelo) : null,
      estado: proximo ? situacaoComPlacar(proximo, disputa.aoVivo, agora) : null,
      dias: proximo ? diasAte(proximo.data, agora) : null,
      times: dados.times,
      // O botão de ingressos segue a regra do site: a loja do mandante, até a hora do jogo.
      // Em campo neutro (ex.: as finais em jogo único) não há mandante vendendo: sem botão.
      ingresso: proximo && !proximo.neutro ? enderecoDoIngresso(proximo, disputa.ingressos, agora) : null,
    });
  });
  paineis.push(...semAdversario.map((id) => painelSemAdversario(lado(id, null), dados.times)));

  // Os vídeos já abertos continuam abertos quando o painel é redesenhado (placar ao vivo).
  const abertos = new Map([...document.querySelectorAll("#disputa-confrontos [data-videos]")]
    .filter((el) => el.querySelector("iframe")).map((el) => [el.dataset.videos, el.innerHTML]));
  $("disputa-confrontos").innerHTML = paineis.join("");
  for (const [id, html] of abertos) {
    const lugar = document.querySelector(`#disputa-confrontos [data-videos="${CSS.escape(id)}"]`);
    if (lugar) lugar.innerHTML = html;
  }

  // Na hora em que o próximo jogo começar: redesenha (o botão de ingressos some e aparece
  // "Ao vivo") e passa a buscar o placar a cada minuto.
  clearTimeout(disputa.despertador);
  const proximos = confrontos.map((c) => c.proximo).filter(Boolean);
  const espera = msAteOProximoInicio(proximos, agora);
  if (espera !== null && espera < 24 * 60 * 60 * 1000) {
    disputa.despertador = setTimeout(() => { desenharDisputa(); acompanharAoVivo(); }, espera + 1000);
  }
}
