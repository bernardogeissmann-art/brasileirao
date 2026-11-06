// acessos.js
// Desenha o painel de acessos a partir de painel/dados/acessos.json (baixado do GoatCounter
// pelo scripts/painel/baixar_acessos.py). Se esse arquivo ainda não existir, mostra os dados
// de exemplo (painel/exemplo-acessos.json), com um aviso bem visível.

const $ = (id) => document.getElementById(id);
const numero = (n) => n.toLocaleString("pt-BR");
const diaCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const diaLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const comoData = (iso) => new Date(`${iso}T12:00:00Z`);
const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

iniciar();

async function iniciar() {
  let dados = await lerJson("dados/acessos.json");
  if (!dados) dados = await lerJson("exemplo-acessos.json");
  if (!dados) {
    $("periodo").textContent = "Não achei nenhum dado. Rode: python scripts/painel/baixar_acessos.py";
    return;
  }
  if (dados.exemplo) {
    $("aviso").hidden = false;
    $("aviso").textContent = "Estes são DADOS DE EXEMPLO, só para mostrar o painel. Para ver os números de verdade, " +
      "crie a conta no GoatCounter e rode o script (passo a passo no começo de scripts/painel/baixar_acessos.py).";
  }
  $("periodo").textContent = `De ${diaCurto.format(comoData(dados.inicio))} a ${diaCurto.format(comoData(dados.fim))}` +
    ` · baixado em ${new Date(dados.baixado_em).toLocaleString("pt-BR")}`;

  montarDestaques(dados.por_dia);
  montarGraficoDias(dados.por_dia);
  montarBarras("paginas", dados.paginas.map((p) => ({ nome: p.titulo || p.pagina, detalhe: p.pagina, visitas: p.visitas })));
  for (const id of ["origens", "telas", "sistemas", "navegadores"]) montarBarras(id, dados[id]);
}

async function lerJson(caminho) {
  try {
    const resposta = await fetch(caminho, { cache: "no-store" });
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

// Os números de destaque: total do período, média por dia, o melhor dia e os últimos 7 dias.
function montarDestaques(porDia) {
  const total = porDia.reduce((s, d) => s + d.visitas, 0);
  const melhor = porDia.reduce((a, b) => (b.visitas > a.visitas ? b : a), porDia[0]);
  const ultimos7 = porDia.slice(-7).reduce((s, d) => s + d.visitas, 0);
  const anteriores7 = porDia.slice(-14, -7).reduce((s, d) => s + d.visitas, 0);
  const variacao = anteriores7 ? Math.round((100 * (ultimos7 - anteriores7)) / anteriores7) : null;
  const itens = [
    ["Visitas no período", numero(total), `${porDia.length} dias`],
    ["Média por dia", numero(Math.round(total / porDia.length)), "visitas"],
    ["Últimos 7 dias", numero(ultimos7),
      variacao === null ? "" : `${variacao >= 0 ? "▲" : "▼"} ${Math.abs(variacao)}% sobre os 7 anteriores`],
    ["Melhor dia", numero(melhor.visitas), diaLongo.format(comoData(melhor.dia))],
  ];
  $("destaques").innerHTML = itens.map(([rotulo, valor, detalhe]) => `
    <div class="destaque"><p class="destaque__rotulo">${rotulo}</p>
      <p class="destaque__valor">${valor}</p><p class="destaque__detalhe">${detalhe}</p></div>`).join("");
}

// Colunas por dia (uma série só, uma cor só). Passar o mouse mostra o dia e as visitas.
function montarGraficoDias(porDia) {
  const largura = 760, altura = 220, margem = { topo: 12, baixo: 26, esquerda: 36, direita: 4 };
  const maximo = Math.max(...porDia.map((d) => d.visitas), 1);
  const passo = niceStep(maximo);
  const topo = Math.ceil(maximo / passo) * passo;
  const areaW = largura - margem.esquerda - margem.direita;
  const areaH = altura - margem.topo - margem.baixo;
  const coluna = areaW / porDia.length;
  const barra = Math.max(2, coluna - 2);   // 2px de espaço entre as colunas
  const y = (v) => margem.topo + areaH - (v / topo) * areaH;

  const linhas = [];
  for (let v = 0; v <= topo; v += passo) {
    linhas.push(`<line class="grade-linha" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="eixo" x="${margem.esquerda - 6}" y="${y(v) + 4}" text-anchor="end">${numero(v)}</text>`);
  }
  const colunas = porDia.map((d, i) => {
    const x = margem.esquerda + i * coluna + (coluna - barra) / 2;
    const h = Math.max(0, margem.topo + areaH - y(d.visitas));
    const rotulo = i % 5 === 0 || i === porDia.length - 1
      ? `<text class="eixo" x="${x + barra / 2}" y="${altura - 8}" text-anchor="middle">${diaCurto.format(comoData(d.dia))}</text>` : "";
    // A área de "toque" (transparente) é a coluna inteira, maior que a barra: fácil de acertar.
    return `<g class="dia" data-i="${i}">
      <rect class="dia__alvo" x="${margem.esquerda + i * coluna}" y="${margem.topo}" width="${coluna}" height="${areaH}"/>
      <path class="dia__barra" d="${caminhoBarra(x, y(d.visitas), barra, h)}"/>${rotulo}</g>`;
  }).join("");

  $("grafico-dias").innerHTML = `
    <svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Visitas por dia; os números estão na tabela logo abaixo">
      ${linhas.join("")}<line class="eixo-base" x1="${margem.esquerda}" x2="${largura - margem.direita}" y1="${y(0)}" y2="${y(0)}"/>
      ${colunas}
    </svg>
    <div class="dica" id="dica" hidden></div>`;

  const dica = $("dica");
  const grafico = $("grafico-dias");
  grafico.addEventListener("pointermove", (evento) => {
    const grupo = evento.target.closest(".dia");
    grafico.querySelectorAll(".dia.ativo").forEach((g) => g !== grupo && g.classList.remove("ativo"));
    if (!grupo) { dica.hidden = true; return; }
    grupo.classList.add("ativo");
    const d = porDia[Number(grupo.dataset.i)];
    dica.innerHTML = `<strong>${numero(d.visitas)}</strong> visitas<br>${diaLongo.format(comoData(d.dia))}`;
    const caixa = grafico.getBoundingClientRect();
    dica.hidden = false;
    dica.style.left = `${Math.min(evento.clientX - caixa.left + 12, caixa.width - dica.offsetWidth - 4)}px`;
    dica.style.top = `${evento.clientY - caixa.top - dica.offsetHeight - 10}px`;
  });
  grafico.addEventListener("pointerleave", () => {
    dica.hidden = true;
    grafico.querySelectorAll(".dia.ativo").forEach((g) => g.classList.remove("ativo"));
  });

  $("tabela-dias").querySelector("tbody").innerHTML = [...porDia].reverse()
    .map((d) => `<tr><td>${diaLongo.format(comoData(d.dia))}</td><td>${numero(d.visitas)}</td></tr>`).join("");
}

// Barra com os cantos de cima arredondados (4px) e a base reta, apoiada no eixo.
function caminhoBarra(x, yTopo, largura, altura) {
  const r = Math.min(4, largura / 2, altura);
  const base = yTopo + altura;
  return `M${x},${base} V${yTopo + r} Q${x},${yTopo} ${x + r},${yTopo} H${x + largura - r}` +
    ` Q${x + largura},${yTopo} ${x + largura},${yTopo + r} V${base} Z`;
}

// Um passo "redondo" para as linhas de grade (1, 2, 5, 10, 20, 50...).
function niceStep(maximo) {
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto);
}

// Lista com barras horizontais: o nome, a barra (proporcional ao maior) e o número.
function montarBarras(id, itens) {
  const lista = $(id);
  if (!itens?.length) { lista.innerHTML = `<li class="vazio">Sem dados no período.</li>`; return; }
  const maximo = Math.max(...itens.map((i) => i.visitas), 1);
  const total = itens.reduce((s, i) => s + i.visitas, 0);
  lista.innerHTML = itens.map((i) => `
    <li title="${escapar(i.detalhe ?? i.nome)}: ${numero(i.visitas)} visitas (${Math.round((100 * i.visitas) / total)}%)">
      <span class="barras__nome">${escapar(i.nome)}</span>
      <span class="barras__trilho"><span class="barras__barra" style="--valor:${i.visitas / maximo}"></span></span>
      <span class="barras__numero">${numero(i.visitas)}</span>
    </li>`).join("");
}
