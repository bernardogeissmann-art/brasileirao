// componentes-briga.js
// O visual do bloco "Reta final" da página Meu Time, para os times numa briga (título, acesso
// ou rebaixamento). Recebe o que briga.js calculou e devolve o HTML (como texto).
// As cores e tamanhos ficam em css/briga.css.

import { escaparHtml, formatarChance, formatarDataJogo } from "./componentes.js";

// O que a chance quer dizer em cada briga ("54% de risco de cair").
const SIGNIFICADO = { titulo: "de chance de título", acesso: "de chance de acesso", rebaixamento: "de risco de cair" };

// Para onde levar o torcedor: a página do campeonato que o time disputa.
const LINKS = {
  "serie-a": [
    { endereco: "simulador.html", texto: "Simular os jogos que faltam", principal: true },
    { endereco: "index.html", texto: "Ver as chances da Série A" },
  ],
  "serie-b": [
    { endereco: "serie-b.html#reta-final", texto: "Ver a reta final da Série B", principal: true },
  ],
};

const pontosEmTexto = (n) => (n === 1 ? "1 ponto" : `${n} pontos`);

// "2 pontos atrás do 16º (Vitória)", "empatado em pontos com o 2º (Palmeiras)"...
function textoDistancia(briga, times) {
  const d = briga.distancia;
  if (!d) return "";
  const quem = `o ${d.posicao}º (${escaparHtml(times[d.id].nome)})`;
  const frase = d.pontos === 0 ? `empatado em pontos com ${quem}`
    : `${pontosEmTexto(d.pontos)} ${d.dentro ? "à frente d" : "atrás d"}${quem}`;
  const onde = {
    titulo: d.dentro ? "Na liderança" : "Fora da liderança",
    acesso: d.dentro ? "Na zona do playoff" : "Fora da zona do playoff",
    rebaixamento: d.dentro ? "Fora da zona de rebaixamento" : "Dentro da zona de rebaixamento",
  }[briga.tipo];
  return `${onde}, ${frase}.`;
}

// Os três cenários do próximo jogo: vitória, empate e derrota.
function cenarios(briga, times) {
  const p = briga.proximo;
  if (!p) return "";
  const adversario = escaparHtml(times[p.adversario].nome);
  const item = (rotulo, valor, classe) => `
    <li class="briga__cenario briga__cenario--${classe}">
      <span>${rotulo}</span><b>${valor === null ? "—" : formatarChance(valor)}</b>
    </li>`;
  return `
    <div class="briga__proximo">
      <p class="briga__subtitulo">Próximo jogo: x ${adversario}, ${p.emCasa ? "em casa" : "fora"} · ${formatarDataJogo(p.data)}</p>
      <ul class="briga__cenarios" aria-label="Chance ${SIGNIFICADO[briga.tipo]} conforme o resultado">
        ${item("Se vencer", p.vitoria, "vitoria")}
        ${item("Se empatar", p.empate, "empate")}
        ${item("Se perder", p.derrota, "derrota")}
      </ul>
    </div>`;
}

// Os outros times da mesma briga.
function rivais(briga, times, escudo) {
  if (briga.rivais.length === 0) return "";
  const linhas = briga.rivais.map((r) => `
    <li>
      <span class="briga__rival-pos">${r.posicao}º</span>
      ${escudo(r.id)}
      <span class="briga__rival-nome"><b>${escaparHtml(times[r.id].nome)}</b>
        <small>${r.pontos} pts${r.proximo ? ` · x ${escaparHtml(times[r.proximo.adversario].nome)}, ${r.proximo.emCasa ? "em casa" : "fora"}` : ""}</small></span>
      <b class="briga__rival-chance">${formatarChance(r.chance)}</b>
    </li>`).join("");
  return `
    <div class="briga__rivais">
      <p class="briga__subtitulo">Quem também está nessa briga</p>
      <ol>${linhas}</ol>
    </div>`;
}

// O bloco inteiro: um cartão por briga (quase sempre uma só).
//   escudo(id): devolve a <img> do escudo (a página já tem essa função).
export function blocoBrigas(brigas, campeonato, times, escudo) {
  const faltam = brigas[0].faltam;
  const cartoes = brigas.map((briga) => `
    <article class="briga" data-tipo="${briga.tipo}">
      <p class="briga__chapeu">Reta final · ${faltam === 1 ? "último jogo" : `faltam ${faltam} jogos`}</p>
      <h2 class="briga__titulo">${escaparHtml(briga.titulo)}</h2>
      <p class="briga__chance"><b>${formatarChance(briga.chance)}</b> <span>${SIGNIFICADO[briga.tipo]}, pelas nossas simulações</span></p>
      <p class="briga__distancia">${textoDistancia(briga, times)}</p>
      <div class="briga__colunas">
        ${cenarios(briga, times)}
        ${rivais(briga, times, escudo)}
      </div>
    </article>`).join("");
  const links = LINKS[campeonato].map((l) =>
    `<a class="botao${l.principal ? "" : " botao--claro"}" href="${l.endereco}">${l.texto}</a>`).join("");
  return `${cartoes}<p class="briga__links">${links}</p>`;
}
