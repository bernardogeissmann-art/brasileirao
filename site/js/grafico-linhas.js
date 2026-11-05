// grafico-linhas.js
// Gráfico de linhas (SVG) para mostrar como uma chance mudou ao longo do tempo.
// Um time fica em destaque (linha colorida); os outros aparecem em cinza ao fundo.
// Ao passar o mouse (ou o dedo) aparece uma linha vertical com os valores daquele momento.
// Clicar numa linha cinza passa o destaque para aquele time.

import { escaparHtml, formatarChance } from "./componentes.js";

const SVG = "http://www.w3.org/2000/svg";

// Desenha o gráfico dentro de "caixa" (um elemento da página).
//   rotulos:  nomes curtos dos momentos no eixo de baixo (ex.: ["Início", "R1", ...])
//   titulos:  nomes completos dos momentos (para o quadro de detalhes)
//   series:   [{ id, nome, valores: [chance em cada momento] }]
//   destaque: id do time em destaque
//   cor:      cor da linha em destaque (ex.: "var(--cor-titulo)")
//   marcado:  (opcional) número do momento escolhido na página, marcado com uma faixa clara
//   aoEscolher: função chamada com o id quando alguém clica numa linha
export function desenharGraficoLinhas(caixa, { rotulos, titulos, series, destaque, cor, marcado, aoEscolher }) {
  const largura = Math.max(300, caixa.clientWidth);
  const estreito = largura < 560;
  const altura = estreito ? 250 : 320;
  const margem = { topo: 14, direita: estreito ? 86 : 132, baixo: 30, esquerda: 38 };
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.baixo;
  const x = (i) => margem.esquerda + (rotulos.length === 1 ? 0 : (i * larguraUtil) / (rotulos.length - 1));
  const y = (v) => margem.topo + (1 - v) * alturaUtil;
  const caminho = (valores) => valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const principal = series.find((s) => s.id === destaque);
  const fundo = series.filter((s) => s.id !== destaque);
  const ultimo = rotulos.length - 1;

  // Linhas de grade (0%, 25%, 50%, 75%, 100%) e eixo de baixo.
  const grade = [0, 0.25, 0.5, 0.75, 1].map((v) => `
    <line class="grafico__grade" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(v)}" y2="${y(v)}"></line>
    <text class="grafico__eixo" x="${margem.esquerda - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join("");

  // Em telas estreitas, mostra um rótulo sim, um não. O último sempre aparece, e o
  // penúltimo some para não encostar nele.
  const salto = estreito && rotulos.length > 8 ? 2 : 1;
  const eixoX = rotulos.map((r, i) => {
    if (i !== ultimo && (i % salto !== 0 || ultimo - i < salto)) return "";
    return `<text class="grafico__eixo" x="${x(i)}" y="${altura - 8}" text-anchor="middle">${escaparHtml(r)}</text>`;
  }).join("");

  // Faixa clara no momento escolhido na página (liga o gráfico à tabela de baixo).
  const passo = rotulos.length > 1 ? larguraUtil / (rotulos.length - 1) : larguraUtil;
  const faixa = marcado === undefined ? "" :
    `<rect class="grafico__marcado" x="${x(marcado) - passo / 2}" y="${margem.topo}" width="${passo}" height="${alturaUtil}"></rect>`;

  // Linhas cinza dos outros times, cada uma com uma "faixa de clique" invisível mais larga.
  const linhasFundo = fundo.map((s) => `
    <path class="grafico__linha-fundo" d="${caminho(s.valores)}"></path>
    <path class="grafico__alvo" d="${caminho(s.valores)}" data-id="${escaparHtml(s.id)}">
      <title>${escaparHtml(s.nome)} (clique para destacar)</title></path>`).join("");

  // Linha do time em destaque, com pontinhos e o nome no fim.
  let linhaPrincipal = "";
  if (principal) {
    const pontos = principal.valores.map((v, i) =>
      `<circle class="grafico__ponto" cx="${x(i)}" cy="${y(v)}" r="3.5" style="fill:${cor}"></circle>`).join("");
    const fim = principal.valores[ultimo];
    linhaPrincipal = `
      <path class="grafico__linha" d="${caminho(principal.valores)}" style="stroke:${cor}"></path>
      ${pontos}
      <text class="grafico__rotulo-fim" x="${x(ultimo) + 10}" y="${y(fim) - 2}">${escaparHtml(principal.nome)}</text>
      <text class="grafico__rotulo-fim grafico__rotulo-fim--valor" x="${x(ultimo) + 10}" y="${y(fim) + 13}">${formatarChance(fim)}</text>`;
  }

  caixa.innerHTML = `
    <svg class="grafico__svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}"
      role="img" aria-label="${escaparHtml(principal ? `Evolução da chance de ${principal.nome}` : "Evolução das chances")}">
      ${faixa}${grade}${eixoX}
      <rect class="grafico__area" x="${margem.esquerda - 10}" y="${margem.topo}" width="${larguraUtil + 20}" height="${alturaUtil}"></rect>
      ${linhasFundo}${linhaPrincipal}
      <line class="grafico__mira" y1="${margem.topo}" y2="${margem.topo + alturaUtil}" visibility="hidden"></line>
    </svg>
    <div class="grafico__dica" hidden></div>`;

  // Clique numa linha cinza: muda o destaque.
  for (const alvo of caixa.querySelectorAll(".grafico__alvo")) {
    alvo.addEventListener("click", () => aoEscolher(alvo.dataset.id));
  }

  // Passar o mouse/dedo: linha vertical + quadro com os valores do momento mais próximo.
  const svg = caixa.querySelector("svg");
  const mira = caixa.querySelector(".grafico__mira");
  const dica = caixa.querySelector(".grafico__dica");
  function mostrar(evento) {
    const caixaSvg = svg.getBoundingClientRect();
    const px = ((evento.clientX - caixaSvg.left) / caixaSvg.width) * largura;
    const i = Math.max(0, Math.min(ultimo, Math.round(((px - margem.esquerda) / larguraUtil) * ultimo)));
    mira.setAttribute("x1", x(i));
    mira.setAttribute("x2", x(i));
    mira.setAttribute("visibility", "visible");
    const ranking = [...series].sort((a, b) => b.valores[i] - a.valores[i]).slice(0, 4);
    if (principal && !ranking.includes(principal)) ranking.push(principal);
    dica.innerHTML = `<strong>${escaparHtml(titulos[i])}</strong>` + ranking.map((s) => `
      <span class="grafico__dica-linha${s === principal ? " grafico__dica-linha--destaque" : ""}">
        <span>${escaparHtml(s.nome)}</span><b>${formatarChance(s.valores[i])}</b></span>`).join("");
    dica.hidden = false;
    // Coloca o quadro do lado que tiver mais espaço.
    const esquerda = (x(i) / largura) * caixaSvg.width;
    dica.style.left = esquerda > caixaSvg.width / 2 ? `${esquerda - dica.offsetWidth - 12}px` : `${esquerda + 12}px`;
  }
  function esconder() {
    mira.setAttribute("visibility", "hidden");
    dica.hidden = true;
  }
  // O movimento é escutado no gráfico inteiro: passando por cima das linhas também vale.
  svg.addEventListener("pointermove", mostrar);
  svg.addEventListener("pointerdown", mostrar);
  svg.addEventListener("pointerleave", esconder);
}
