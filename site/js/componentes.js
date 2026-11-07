// componentes.js
// As peças visuais reaproveitáveis do site. Cada função recebe os dados e devolve
// um pedaço de HTML (como texto). As páginas juntam essas peças e colocam na tela.
// O visual (cores, tamanhos) fica no CSS; aqui só decidimos o que vai em cada peça.

import { ABAS } from "./abas.js";
import { FAIXAS } from "./simulacao.js";
import { iniciarContador } from "./contador.js";

// As 4 categorias de chance da Série A, na ordem em que aparecem em todo o site.
export const CATEGORIAS = [
  { campo: "titulo", rotulo: "Título", faixa: "" },
  { campo: "libertadores", rotulo: "Libertadores", faixa: "1º–5º" },
  { campo: "sulamericana", rotulo: "Sul-Americana", faixa: "6º–11º" },
  { campo: "rebaixamento", rotulo: "Rebaixamento", faixa: "17º–20º" },
];

// As 4 categorias da Série B. "classe" escolhe a cor (reaproveita as cores da Série A):
// acesso em azul, playoff em verde-água. O acesso já inclui quem sobe pelo playoff.
export const CATEGORIAS_SERIE_B = [
  { campo: "titulo", rotulo: "Título", faixa: "" },
  { campo: "acesso", rotulo: "Acesso", faixa: "1º–2º ou playoff", classe: "libertadores" },
  { campo: "playoff", rotulo: "Playoff", faixa: "3º–6º", classe: "sulamericana" },
  { campo: "rebaixamento", rotulo: "Rebaixamento", faixa: "17º–20º" },
];

// Zona da tabela na Série B (a faixa colorida do card), a partir das faixas da ficha.
export function zonaSerieB(posicao, faixas) {
  const dentro = ([de, ate]) => posicao >= de && posicao <= ate;
  if (dentro(faixas.titulo)) return "titulo";
  if (dentro(faixas.acesso_direto)) return "libertadores";
  if (dentro(faixas.playoff)) return "sulamericana";
  if (dentro(faixas.rebaixamento)) return "rebaixamento";
  return "neutra";
}

// ---------------------------------------------------------------------------
// AJUDANTES
// ---------------------------------------------------------------------------

// Troca caracteres especiais (<, >, &, aspas) por versões seguras para o HTML,
// para que um nome estranho nunca vire código dentro da página.
export function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Mostra uma chance (de 0 a 1) como texto curto: 0.814 -> "81%".
// Evitamos dizer 0% ou 100% quando não é certeza absoluta nas simulações.
export function formatarChance(p) {
  if (p === 0) return "–";        // não aconteceu em nenhuma simulação
  if (p === 1) return "100%";     // aconteceu em todas
  if (p < 0.01) return "<1%";
  if (p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

// Versão com uma casa decimal, para a dica que aparece ao passar o mouse: "81,4%".
function formatarChancePrecisa(p) {
  return `${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Variação em pontos percentuais (p.p.): de 0,40 para 0,52 é "+12 p.p.".
// Devolve "" (nada) quando a mudança arredondada é zero.
function formatarVariacao(diferenca) {
  const pp = Math.round(diferenca * 100);
  if (pp === 0) return "";
  return pp > 0 ? `+${pp} p.p.` : `−${Math.abs(pp)} p.p.`;
}

// Saldo de gols sempre com sinal: +12, -3, 0.
function formatarSaldo(saldo) {
  return saldo > 0 ? `+${saldo}` : String(saldo);
}

// "2026-11-04T21:20:36-03:00" -> "04/11/2026 às 21:20" (no horário de Brasília).
export function formatarData(iso) {
  const formato = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return formato.format(new Date(iso)).replace(", ", " às ");
}

// Data curta de um jogo: "sáb 08/11 · 16:00".
export function formatarDataJogo(iso) {
  const data = new Date(iso);
  const opcoes = { timeZone: "America/Sao_Paulo" };
  const dia = new Intl.DateTimeFormat("pt-BR", { ...opcoes, weekday: "short" }).format(data).replace(".", "");
  const diaMes = new Intl.DateTimeFormat("pt-BR", { ...opcoes, day: "2-digit", month: "2-digit" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { ...opcoes, hour: "2-digit", minute: "2-digit" }).format(data);
  return `${dia} ${diaMes} · ${hora}`;
}

// Em que zona da tabela fica uma posição (para a faixa colorida do card).
function zonaDaPosicao(posicao) {
  const dentro = ([de, ate]) => posicao >= de && posicao <= ate;
  if (dentro(FAIXAS.titulo)) return "titulo";
  if (dentro(FAIXAS.g4)) return "libertadores";
  if (dentro(FAIXAS.libertadores)) return "preliminar";
  if (dentro(FAIXAS.sulamericana)) return "sulamericana";
  if (dentro(FAIXAS.rebaixamento)) return "rebaixamento";
  return "neutra";
}

// Imagem do escudo. O jogos.json guarda o caminho a partir da pasta do projeto
// (ex.: "assets/escudos/flamengo.svg"); daqui (site/js/) subimos duas pastas.
// alt="" porque o nome do time já aparece ao lado (o escudo é só decoração).
function escudo(time, classe) {
  if (!time.escudo) {
    return `<span class="${classe} escudo-vazio" aria-hidden="true">${escaparHtml(time.sigla ?? "")}</span>`;
  }
  const endereco = new URL(`../../${time.escudo}`, import.meta.url);
  return `<img class="${classe}" src="${endereco}" alt="" width="36" height="36">`;
}


// ---------------------------------------------------------------------------
// TOPO, RODAPÉ E MENSAGENS
// ---------------------------------------------------------------------------

// Uma opção do menu suspenso (link com símbolo opcional).
function opcaoDoMenu(item, abaAtual) {
  const simbolo = item.simbolo
    ? `<img class="menu-abas__simbolo" src="${new URL(`../../${item.simbolo}`, import.meta.url)}" alt="" width="32" height="32">`
    : "";
  const atual = item.id === abaAtual ? ' aria-current="page"' : "";
  return `<a class="menu-abas__item" href="${item.endereco}"${atual}>${simbolo}<span>${escaparHtml(item.rotulo)}</span></a>`;
}

// Topo com a marca e o menu. "abaAtual" é o id da página em que estamos.
// Abas com "itens" viram um botão que abre um painel com as opções (menu suspenso).
// Abas com "secoes" também, mas o painel fica dividido em partes, cada uma com seu título.
// O painel fica fora da faixa de abas porque, no celular, essa faixa rola para o lado
// e cortaria qualquer coisa que saísse dela.
function montarCabecalho(abaAtual) {
  const paineis = [];
  const itens = ABAS.map((aba) => {
    if (aba.itens || aba.secoes) {
      // Sem seções, o painel é uma seção só, com o nome da própria aba como título.
      const secoes = aba.secoes ?? [{ rotulo: aba.rotulo, itens: aba.itens }];
      const dentro = secoes.some((secao) => secao.itens.some((item) => item.id === abaAtual));
      const partes = secoes.map((secao) => `
          <div class="menu-abas__secao">
            <p class="menu-abas__titulo">${escaparHtml(secao.rotulo)}</p>
            ${secao.itens.map((item) => opcaoDoMenu(item, abaAtual)).join("")}
          </div>`).join("");
      paineis.push(`
        <div class="menu-abas" id="menu-${aba.id}" hidden>${partes}
        </div>`);
      return `<button type="button" class="aba aba--grupo${dentro ? " aba--ativa" : ""}" aria-expanded="false"
        aria-controls="menu-${aba.id}">${escaparHtml(aba.rotulo)}<span class="aba__seta" aria-hidden="true">▾</span></button>`;
    }
    const atual = aba.id === abaAtual ? ' aria-current="page"' : "";
    return `<a class="aba" href="${aba.endereco}"${atual}>${escaparHtml(aba.rotulo)}</a>`;
  }).join("");

  return `
    <div class="largura topo__interno">
      <a class="marca" href="index.html" aria-label="Prob.com, página inicial">Prob<span class="marca__bola" aria-hidden="true"></span>com</a>
      <nav class="abas" aria-label="Seções do site">${itens}</nav>
    </div>
    ${paineis.join("")}`;
}

// Coloca o topo na página e faz os menus suspensos funcionarem.
//   elemento: o <header> da página
//   abaAtual: o id da página em que estamos
export function instalarCabecalho(elemento, abaAtual) {
  elemento.innerHTML = montarCabecalho(abaAtual);
  iniciarContador();   // conta a visita (todas as páginas instalam o topo; ver contador.js)

  // No celular a faixa de abas rola para o lado: já começa mostrando a aba da página atual.
  const faixa = elemento.querySelector(".abas");
  const ativa = faixa.querySelector('[aria-current="page"], .aba--ativa');
  if (ativa && faixa.scrollWidth > faixa.clientWidth) {
    faixa.scrollLeft = ativa.offsetLeft - faixa.offsetLeft - (faixa.clientWidth - ativa.offsetWidth) / 2;
  }

  for (const botao of elemento.querySelectorAll(".aba--grupo")) {
    const painel = document.getElementById(botao.getAttribute("aria-controls"));

    const fechar = () => {
      botao.setAttribute("aria-expanded", "false");
      painel.hidden = true;
    };
    const abrir = () => {
      botao.setAttribute("aria-expanded", "true");
      painel.hidden = false;
      // Põe o painel logo abaixo do botão, sem deixar que saia da tela.
      const topo = elemento.getBoundingClientRect();
      const caixa = botao.getBoundingClientRect();
      const maximo = document.documentElement.clientWidth - painel.offsetWidth - 12;
      painel.style.left = `${Math.max(12, Math.min(caixa.left, maximo)) - topo.left}px`;
      painel.style.top = `${caixa.bottom - topo.top + 8}px`;
    };

    botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
    // Clique fora do botão e do painel: fecha.
    document.addEventListener("click", (evento) => {
      if (!painel.hidden && !painel.contains(evento.target) && !botao.contains(evento.target)) fechar();
    });
    // Tecla Esc: fecha e devolve o foco ao botão.
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && !painel.hidden) { fechar(); botao.focus(); }
    });
    // Se a faixa de abas rolar ou a tela mudar de tamanho, o painel fecha (sairia do lugar).
    elemento.querySelector(".abas").addEventListener("scroll", fechar);
    window.addEventListener("resize", fechar);
  }
}

// Rodapé com o crédito e a data da última atualização dos dados.
export function montarRodape(atualizadoEm) {
  const data = atualizadoEm ? formatarData(atualizadoEm) : "carregando…";
  return `
    <div class="largura rodape__interno">
      <p class="marca rodape__marca" aria-hidden="true">Prob<span class="marca__bola"></span>com</p>
      <p>Inspirado no projeto Probabilidades no Futebol, do Departamento de Matemática da UFMG. Modelo e código próprios.</p>
      <p>Última atualização: ${data}</p>
    </div>`;
}

// Mensagem no lugar de uma lista (carregando ou erro). "html" já vem pronto.
export function mensagem(html, tipo) {
  return `<li class="mensagem mensagem--${tipo}">${html}</li>`;
}


// ---------------------------------------------------------------------------
// TABELA DE CHANCES
// ---------------------------------------------------------------------------

// Legenda com as cores das categorias. Categorias com a mesma cor aparecem uma vez só,
// com os nomes juntos (ex.: "Quartas, Semifinal, Final").
export function legendaCategorias(categorias = CATEGORIAS) {
  const porCor = new Map();
  for (const { campo, rotulo, faixa, classe } of categorias) {
    const cor = classe ?? campo;
    if (!porCor.has(cor)) porCor.set(cor, []);
    porCor.get(cor).push(faixa ? `${rotulo} (${faixa})` : rotulo);
  }
  const itens = [...porCor].map(([cor, nomes]) =>
    `<li><span class="legenda__cor barra-chance--${cor}"></span>${nomes.join(", ")}</li>`);
  return `<ul class="legenda" aria-label="Cores das categorias">${itens.join("")}</ul>`;
}

// Cabeçalho das colunas da tabela (só aparece quando a tabela fica larga).
export function cabecalhoColunas(categorias = CATEGORIAS) {
  const chances = categorias.map(({ campo, rotulo, classe }) =>
    `<span class="coluna-chance coluna-chance--${classe ?? campo}">${rotulo}</span>`).join("");
  return `
    <div class="cabecalho-colunas" aria-hidden="true">
      <span>#</span><span></span><span>Time</span>
      <span class="numerica">P</span><span class="numerica">J</span>
      <span class="numerica">V</span><span class="numerica">SG</span>
      ${chances}
    </div>`;
}

// Barra de chance. "categoria" escolhe a cor (titulo, libertadores, sulamericana, rebaixamento).
// "base" (opcional) é a chance no cenário sem palpites: aparece como um tracinho
// na barra e como a variação em p.p. ao lado.
export function barraChance({ rotulo, valor, categoria, nomeTime, base }) {
  const classeValor = valor === 0 ? "barra-chance__valor zero" : "barra-chance__valor";
  const classeCheio = valor > 0 ? "barra-chance__preenchimento tem-valor" : "barra-chance__preenchimento";
  const variacao = base === undefined ? "" : formatarVariacao(valor - base);
  // "title" é a dica que aparece ao parar o mouse em cima, com o número mais preciso.
  let dica = `${nomeTime} · ${rotulo}: ${formatarChancePrecisa(valor)}`;
  if (variacao) dica += ` (sem palpites: ${formatarChancePrecisa(base)})`;

  const marca = variacao ? `<span class="barra-chance__marca" style="--base: ${base}"></span>` : "";
  const textoVariacao = variacao
    ? `<span class="barra-chance__variacao">${variacao}<span class="so-leitor"> em relação ao cenário sem palpites</span></span>`
    : "";

  return `
    <div class="barra-chance barra-chance--${categoria}" style="--valor: ${valor}" title="${escaparHtml(dica)}">
      <span class="barra-chance__rotulo">${rotulo}</span>
      <span class="barra-chance__trilho" aria-hidden="true"><span class="${classeCheio}"></span>${marca}</span>
      <span class="${classeValor}">${formatarChance(valor)}<span class="so-leitor"> de chance</span></span>
      ${textoVariacao}
    </div>`;
}

// Card de um time: posição, escudo, nome, pontos, números e as 4 barras de chance.
//   linha:   a linha do time na tabela (posição, pontos, jogos...)
//   time:    a ficha do time no jogos.json (nome, escudo...)
//   chances: o resultado da simulação para este time
//   base:    (opcional) o resultado sem palpites, para mostrar quanto mudou
//   categorias: (opcional) quais chances mostrar; o padrão são as 4 do Brasileirão
//   zona: (opcional) a cor da faixa lateral; o padrão são as zonas do Brasileirão
export function cardTime({ linha, time, chances, base, categorias = CATEGORIAS, zona }) {
  const nome = escaparHtml(time.nome);
  const barras = categorias.map(({ campo, rotulo, classe }) => barraChance({
    rotulo, valor: chances[campo], categoria: classe ?? campo, nomeTime: time.nome, base: base?.[campo],
  })).join("");

  return `
    <li class="card-time" data-zona="${zona ?? zonaDaPosicao(linha.posicao)}">
      <span class="card-time__posicao"><span class="so-leitor">Posição </span>${linha.posicao}</span>
      ${escudo(time, "card-time__escudo")}
      <strong class="card-time__nome">${nome}</strong>
      <span class="card-time__pontos"><b>${linha.pontos}</b><span class="card-time__pontos-rotulo">pts</span><span class="so-leitor"> pontos</span></span>
      <span class="card-time__numeros">
        <span class="numero"><b>${linha.jogos}</b> <span class="numero__rotulo" aria-hidden="true">J</span><span class="so-leitor"> jogos</span></span>
        <span class="numero"><b>${linha.vitorias}</b> <span class="numero__rotulo" aria-hidden="true">V</span><span class="so-leitor"> vitórias</span></span>
        <span class="numero"><span class="numero__rotulo" aria-hidden="true">SG </span><span class="so-leitor">saldo de gols </span><b>${formatarSaldo(linha.saldo)}</b></span>
      </span>
      <div class="card-time__chances">${barras}</div>
    </li>`;
}

// Anel de chance: um círculo que vai se completando conforme a chance (0% vazio, 100% cheio),
// com o número no meio e o nome embaixo. "cor" é a cor do anel (ex.: a cor do clube).
export function anelChance({ rotulo, valor, cor }) {
  const raio = 34;
  const volta = 2 * Math.PI * raio;   // o comprimento do círculo inteiro
  return `
    <figure class="anel" style="--cor-anel: ${cor}">
      <div class="anel__grafico">
        <svg class="anel__svg" viewBox="0 0 84 84" aria-hidden="true">
          <circle class="anel__trilho" cx="42" cy="42" r="${raio}"></circle>
          <circle class="anel__valor" cx="42" cy="42" r="${raio}"
            stroke-dasharray="${volta.toFixed(2)}" stroke-dashoffset="${(volta * (1 - valor)).toFixed(2)}"></circle>
        </svg>
        <span class="anel__numero">${formatarChance(valor)}</span>
      </div>
      <figcaption class="anel__rotulo">${escaparHtml(rotulo)}<span class="so-leitor">: ${formatarChancePrecisa(valor)} de chance</span></figcaption>
    </figure>`;
}

// Cartão de destaque: um rótulo, um time, um número grande e, embaixo, uma frase
// explicando o número (numa linha própria, com a largura toda do cartão).
export function cartaoDestaque({ rotulo, time, valor, complemento }) {
  return `
    <article class="destaque">
      <p class="destaque__rotulo">${rotulo}</p>
      <div class="destaque__corpo">
        ${escudo(time, "destaque__escudo")}
        <p class="destaque__time">${escaparHtml(time.nome)}</p>
        <p class="destaque__valor">${formatarChance(valor)}</p>
        <p class="destaque__complemento">${complemento}</p>
      </div>
    </article>`;
}


// ---------------------------------------------------------------------------
// UM JOGO: GRÁFICO DE GOLS E BARRA DE RESULTADO (página "O Método")
// ---------------------------------------------------------------------------

// Gráfico de colunas: a chance de um time fazer 0, 1, 2, 3, 4 ou 5+ gols.
// "chances" é a lista vinda de distribuicaoGols (chance de 0, 1, 2, ... gols).
export function colunasGols({ time, media, chances }) {
  const faixas = [0, 1, 2, 3, 4].map((gols) => ({ rotulo: String(gols), chance: chances[gols] }));
  faixas.push({ rotulo: "5+", chance: chances.slice(5).reduce((a, b) => a + b, 0) });
  const maior = Math.max(...faixas.map((f) => f.chance));

  const colunas = faixas.map(({ rotulo, chance }) => {
    const dica = `${time.nome} fazer ${rotulo} ${rotulo === "1" ? "gol" : "gols"}: ${formatarChancePrecisa(chance)}`;
    return `
      <div class="colunas-gols__coluna" role="listitem" title="${escaparHtml(dica)}" style="--altura: ${chance / maior}">
        <span class="so-leitor">${rotulo} gols: </span>
        <span class="colunas-gols__valor">${formatarChance(chance)}</span>
        <span class="colunas-gols__barra" aria-hidden="true"></span>
      </div>`;
  }).join("");
  // Os números do eixo (0, 1, 2...) ficam numa linha própria, embaixo das colunas.
  const eixo = faixas.map(({ rotulo }) => `<span>${rotulo}</span>`).join("");

  return `
    <figure class="colunas-gols">
      <figcaption class="colunas-gols__titulo">
        ${escudo(time, "colunas-gols__escudo")}
        <span><strong>${escaparHtml(time.nome)}</strong><span class="colunas-gols__media">média de ${formatarGols(media, 1)}</span></span>
      </figcaption>
      <div class="colunas-gols__grade" role="list">${colunas}</div>
      <div class="colunas-gols__eixo" aria-hidden="true">${eixo}</div>
      <p class="colunas-gols__legenda-eixo" aria-hidden="true">gols no jogo</p>
    </figure>`;
}

// "1,8 gol", "2,0 gols": em português, o plural começa no 2 (olhando o número já arredondado).
export function formatarGols(media, casas) {
  const texto = media.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const arredondado = Number(media.toFixed(casas));
  return `${texto} ${arredondado >= 2 ? "gols" : "gol"}`;
}

// Barra dividida em três partes: vitória do mandante, empate, vitória do visitante.
// Uma parte estreita demais para caber o número fica sem texto (o número aparece
// ao passar o mouse e na leitura para leitores de tela).
export function barraResultado({ nomeMandante, nomeVisitante, vitoriaM, empate, vitoriaV, rotulo }) {
  const partes = [
    { classe: "mandante", nome: `Vitória do ${nomeMandante}`, chance: vitoriaM },
    { classe: "empate", nome: "Empate", chance: empate },
    { classe: "visitante", nome: `Vitória do ${nomeVisitante}`, chance: vitoriaV },
  ].filter((parte) => parte.chance > 0);

  const descricao = partes.map((p) => `${p.nome}: ${formatarChancePrecisa(p.chance)}`).join(", ");
  const blocos = partes.map((p) => `
    <span class="barra-resultado__parte barra-resultado__parte--${p.classe}" style="flex-grow: ${p.chance}"
      title="${escaparHtml(`${p.nome}: ${formatarChancePrecisa(p.chance)}`)}">${p.chance >= 0.12 ? formatarChance(p.chance) : ""}</span>`).join("");

  return `
    <div class="barra-resultado">
      ${rotulo ? `<span class="barra-resultado__rotulo">${rotulo}</span>` : ""}
      <div class="barra-resultado__barra" role="img" aria-label="${escaparHtml(descricao)}">${blocos}</div>
    </div>`;
}

// Legenda das três partes da barra de resultado.
export function legendaResultado(nomeMandante, nomeVisitante) {
  return `
    <ul class="legenda">
      <li><span class="legenda__cor" style="--cor: var(--cor-mandante)"></span>Vitória do ${escaparHtml(nomeMandante)}</li>
      <li><span class="legenda__cor" style="--cor: var(--cor-empate)"></span>Empate</li>
      <li><span class="legenda__cor" style="--cor: var(--cor-visitante)"></span>Vitória do ${escaparHtml(nomeVisitante)}</li>
    </ul>`;
}


// ---------------------------------------------------------------------------
// JOGOS DO DIA (página principal)
// ---------------------------------------------------------------------------

// "Apelido" de um canal, sem acentos, espaços nem símbolos: "Prime Video" vira "primevideo",
// "CazéTV" vira "cazetv". Serve para dar a cada canal a sua cor (as cores ficam no componentes.css).
function apelidoDoCanal(nome) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// A sequência recente de um time em quadradinhos: V (verde), E (cinza), D (vermelho).
// A letra vai escrita dentro, para não depender só da cor.
function formaRecente(forma) {
  if (forma.length === 0) return "";
  const nomes = { V: "vitória", E: "empate", D: "derrota" };
  const itens = forma.map((r) => `<span class="forma__item forma__item--${r}" aria-hidden="true">${r}</span>`).join("");
  return `<span class="forma" title="Últimos jogos, do mais antigo ao mais recente">${itens}<span class="so-leitor">Últimos jogos: ${forma.map((r) => nomes[r]).join(", ")}</span></span>`;
}

// Cartão de um confronto do dia: horário, estádio, os dois times (com posição, pontos e
// sequência recente), as chances do jogo pelo modelo e onde assistir.
//   jogo:      o jogo, do jogos.json
//   times:     os times do jogos.json
//   tabela:    Map id -> linha da tabela atual (posição, pontos...)
//   forma:     { mandante: ["V", ...], visitante: [...] }
//   chances:   o que chancesDoJogo() devolve (vitória, empate, placar mais provável...)
//   estado:    o que situacaoComPlacar() devolve (veja jogos-do-dia.js):
//              { situacao: "antes" | "andamento" | "intervalo" | "aguardando" | "encerrado",
//                gols: [mandante, visitante] quando há placar, minuto: "67'" quando a bola rola }
//   ingresso: (opcional) endereço para comprar ingressos; sem ele, não há botão
//   descricao: (opcional) o texto embaixo do nome de cada time, no lugar de "posição · pontos"
//              (ex.: o país, na Sul-Americana). Recebe o id do time e o lado ("mandante"/"visitante").
//   fase:      (opcional) o texto do topo do cartão, no lugar de "Rodada 33" (ex.: "Final")
export function cardConfronto({ jogo, times, tabela, forma, chances, estado, ingresso, descricao, fase }) {
  const { situacao, gols, minuto } = estado;
  const temPlacar = Array.isArray(gols);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    .format(new Date(jogo.data));
  const aoVivo = temPlacar ? `Ao vivo${minuto ? ` · ${escaparHtml(minuto)}` : ""}` : `Começou às ${hora}`;
  const selo = {
    antes: `<span class="confronto__hora">${hora}</span>`,
    andamento: `<span class="confronto__selo confronto__selo--agora">${aoVivo}</span>`,
    intervalo: `<span class="confronto__selo confronto__selo--agora">Intervalo</span>`,
    aguardando: `<span class="confronto__selo">Começou às ${hora} · placar na próxima atualização</span>`,
    encerrado: `<span class="confronto__selo">Encerrado</span>`,
  }[situacao];

  const linhaTime = (lado) => {
    const id = jogo[lado];
    const time = times[id];
    const linha = tabela?.get(id);
    const texto = descricao
      ? descricao(id, lado)
      : `${linha.posicao}º · ${linha.pontos} pts${lado === "mandante" ? " · em casa" : ""}`;
    const placar = temPlacar ? `<b class="confronto__placar">${Number(gols[lado === "mandante" ? 0 : 1])}</b>` : "";
    return `
      <div class="confronto__time">
        ${escudo(time, "confronto__escudo")}
        <span class="confronto__nome">
          <strong>${escaparHtml(time.nome)}</strong>
          <small>${escaparHtml(texto)}</small>
        </span>
        ${formaRecente(forma[lado])}
        ${placar}
      </div>`;
  };

  // As chances só fazem sentido antes do jogo acabar. Com a bola rolando, elas continuam
  // na tela, mas avisando que são as de antes do jogo (o modelo não acompanha o placar).
  let previsao = "";
  if (situacao !== "encerrado") {
    const rotulo = situacao === "antes" ? "" : `<p class="confronto__aviso">Chances antes do jogo</p>`;
    const { placarMaisProvavel: p } = chances;
    const umaCasa = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    previsao = `${rotulo}
      ${barraResultado({ nomeMandante: times[jogo.mandante].nome, nomeVisitante: times[jogo.visitante].nome,
        vitoriaM: chances.vitoriaM, empate: chances.empate, vitoriaV: chances.vitoriaV })}
      <p class="confronto__previsao">
        <span>Placar mais provável <b>${p.gols_mandante} × ${p.gols_visitante}</b></span>
        <span>Gols esperados <b>${umaCasa(chances.mediaM)} × ${umaCasa(chances.mediaV)}</b></span>
      </p>`;
  }

  // Onde assistir: os canais vêm do ge.globo (escapados, porque vêm de fora).
  const semInformacao = situacao === "antes" ? "ainda não divulgado" : "não informado";
  const canais = jogo.transmissao?.length
    ? jogo.transmissao.map((c) => `<li class="canal canal--${apelidoDoCanal(c)}">${escaparHtml(c)}</li>`).join("")
    : `<li class="canal canal--vazio">${semInformacao}</li>`;

  return `
    <li class="confronto">
      <p class="confronto__topo">
        ${selo}
        <span class="confronto__info">${escaparHtml(fase ?? (jogo.rodada ? `Rodada ${jogo.rodada}` : "Playoff"))}${jogo.estadio ? ` · ${escaparHtml(jogo.estadio)}` : ""}</span>
      </p>
      ${linhaTime("mandante")}
      ${linhaTime("visitante")}
      ${previsao}
      <div class="confronto__onde">
        <span class="confronto__onde-rotulo">Onde assistir</span>
        <ul class="canais">${canais}</ul>
      </div>
      ${ingresso ? botaoIngresso(ingresso, times[jogo.mandante].nome) : ""}
    </li>`;
}

// Botão "Comprar ingressos": abre a loja de ingressos do time da casa, em outra aba.
export function botaoIngresso(endereco, nomeMandante) {
  return `
      <a class="botao-ingresso" href="${escaparHtml(endereco)}" target="_blank" rel="noopener noreferrer">
        Comprar ingressos<span class="so-leitor"> (loja de ingressos do ${escaparHtml(nomeMandante)}, abre em outra aba)</span>
        <span aria-hidden="true">↗</span>
      </a>`;
}


// ---------------------------------------------------------------------------
// SIMULADOR: JOGOS E RODADAS
// ---------------------------------------------------------------------------

// Card de um jogo, no formato de placar de aplicativo: mandante em cima, visitante
// embaixo, cada um com o seu campo de gols à direita. Embaixo do mandante aparece o
// estádio do jogo ("Casa – Estádio ..."), quando a fonte informa.
// inputmode="numeric" abre o teclado de números no celular.
export function cardJogo(jogo, times) {
  const adiado = jogo.status_fonte === "POSTPONED" ? `<span class="card-jogo__selo">adiado</span>` : "";
  const casa = `<span class="card-jogo__casa">Casa${jogo.estadio ? ` – ${escaparHtml(jogo.estadio)}` : ""}</span>`;
  const linha = (lado, time) => `
    <label class="card-jogo__linha">
      ${escudo(time, "card-jogo__escudo")}
      <span class="card-jogo__nome">${escaparHtml(time.nome)}${lado === "mandante" ? casa : ""}</span>
      <input class="card-jogo__gols" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2"
        autocomplete="off" enterkeyhint="next" data-lado="${lado}">
      <span class="so-leitor"> gols</span>
    </label>`;

  return `
    <li class="card-jogo" data-id="${jogo.id}">
      <p class="card-jogo__data">${formatarDataJogo(jogo.data)}${adiado}</p>
      ${linha("mandante", times[jogo.mandante])}
      ${linha("visitante", times[jogo.visitante])}
    </li>`;
}

// Uma rodada: título, botão de limpar só esta rodada e a lista dos seus jogos.
export function secaoRodada(rodada, jogosDaRodada, times) {
  return `
    <section class="rodada" data-rodada="${rodada}" aria-labelledby="rodada-${rodada}">
      <div class="rodada__topo">
        <h3 class="rodada__titulo" id="rodada-${rodada}">Rodada ${rodada}</h3>
        <button type="button" class="botao botao--texto" data-limpar-rodada="${rodada}" hidden>Limpar rodada</button>
      </div>
      <ol class="lista-jogos">${jogosDaRodada.map((jogo) => cardJogo(jogo, times)).join("")}</ol>
    </section>`;
}
