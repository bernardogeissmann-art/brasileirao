// componentes-reta-final.js
// O visual do painel "Reta final" da Série B: recebe o que reta-final.js calculou e
// devolve o HTML (como texto). As cores e tamanhos ficam em css/reta-final.css.

import { escaparHtml, escudo, formatarChance, formatarDataJogo } from "./componentes.js";

// Uma célula de chance, com o fundo mais forte quanto maior a chance.
// "--forca" vai de 0 a 1 e o CSS usa esse número para misturar a cor.
function celulaChance(valor, rotulo) {
  if (valor === null || valor === undefined) {
    return `<td class="disputa__celula disputa__celula--vazia"><span class="so-leitor">${rotulo}: </span>—</td>`;
  }
  return `<td class="disputa__celula" style="--forca:${valor.toFixed(3)}"><span class="so-leitor">${rotulo}: </span>${formatarChance(valor)}</td>`;
}

// Nome curto de um time, com o escudo pequeno ao lado.
function timeCurto(time) {
  return `<span class="rf-time">${escudo(time, "rf-time__escudo")}<span>${escaparHtml(time.nome)}</span></span>`;
}

// Um quadro de disputa (ex.: "Acesso direto"), com uma linha por time que ainda briga.
function quadroDisputa(disputa, times) {
  const garantidos = disputa.garantidos.length === 0 ? "" : `
    <p class="disputa__garantidos">
      <span>${disputa.ruim ? "Já caíram" : "Já garantidos"}:</span>
      ${disputa.garantidos.map((id) => timeCurto(times[id])).join("")}
    </p>`;

  const linhas = disputa.times.map((linha) => {
    const jogo = linha.ultimoJogo;
    const adversario = jogo
      ? `<span class="disputa__jogo">x ${escaparHtml(times[jogo.adversario].nome)}, ${jogo.emCasa ? "em casa" : "fora"}</span>`
      : `<span class="disputa__jogo">sem jogos</span>`;
    return `
      <tr>
        <th scope="row" class="disputa__time">
          <span class="disputa__posicao">${linha.posicao}º</span>
          ${escudo(times[linha.id], "rf-time__escudo")}
          <span class="disputa__nome"><b>${escaparHtml(times[linha.id].nome)}</b>
            <span class="disputa__detalhe">${linha.pontos} pts · ${adversario}</span></span>
        </th>
        ${celulaChance(linha.chance, "Hoje")}
        ${celulaChance(jogo?.vitoria, "Se vencer")}
        ${celulaChance(jogo?.empate, "Se empatar")}
        ${celulaChance(jogo?.derrota, "Se perder")}
      </tr>`;
  }).join("");

  return `
    <article class="disputa" data-cor="${disputa.cor}">
      <h3 class="disputa__titulo">${escaparHtml(disputa.titulo)} <span>${escaparHtml(disputa.detalhe)}</span></h3>
      ${garantidos}
      <table class="disputa__tabela">
        <thead>
          <tr>
            <th scope="col"><span class="so-leitor">Time</span></th>
            <th scope="col">Hoje</th>
            <th scope="col">Vitória</th>
            <th scope="col">Empate</th>
            <th scope="col">Derrota</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </article>`;
}

// Todas as disputas, lado a lado.
export function blocoDisputas(disputas, times) {
  if (disputas.length === 0) return "";
  return `<div class="disputas">${disputas.map((d) => quadroDisputa(d, times)).join("")}</div>`;
}

// Uma lista de candidatos a uma posição (ex.: quem pode terminar em 3º).
function listaCandidatos(posicao, candidatos, times) {
  const itens = candidatos.map((c) => `
    <li>${timeCurto(times[c.id])}<b>${formatarChance(c.chance)}</b></li>`).join("");
  return `
    <div class="chave__vaga">
      <p class="chave__posicao">${posicao}º</p>
      <ol class="chave__candidatos">${itens}</ol>
    </div>`;
}

// Os jogos de um confronto já marcados (ida e volta), com o placar se já aconteceram.
function jogosDoConfronto(jogos, times) {
  if (jogos.length === 0) return "";
  const itens = jogos.map((j, i) => {
    const placar = j.disputado ? `${j.gols_mandante} x ${j.gols_visitante}` : "x";
    return `<li><span>${i === 0 ? "Ida" : "Volta"} · ${formatarDataJogo(j.data)}</span>
      <b>${escaparHtml(times[j.mandante].sigla ?? times[j.mandante].nome)} ${placar} ${escaparHtml(times[j.visitante].sigla ?? times[j.visitante].nome)}</b></li>`;
  }).join("");
  return `<ul class="dupla__jogos">${itens}</ul>`;
}

// Um confronto do playoff (ex.: 3º x 6º).
function quadroChave(chave, times) {
  const certa = chave.duplas.length === 1 && chave.duplas[0].chance === 1;
  const duplas = chave.duplas.map((d) => `
    <li class="dupla">
      <p class="dupla__times">${timeCurto(times[d.melhor])}<span class="dupla__x">x</span>${timeCurto(times[d.pior])}</p>
      <p class="dupla__numeros">
        ${certa ? "" : `<span>Chance deste confronto: <b>${formatarChance(d.chance)}</b></span>`}
        <span>Passa: ${escaparHtml(times[d.melhor].nome)} <b>${formatarChance(d.passaMelhor)}</b> ·
          ${escaparHtml(times[d.pior].nome)} <b>${formatarChance(1 - d.passaMelhor)}</b></span>
      </p>
      ${jogosDoConfronto(d.jogos, times)}
    </li>`).join("");

  return `
    <article class="chave">
      <h4 class="chave__titulo">${chave.melhor}º x ${chave.pior}º</h4>
      ${certa ? "" : `<div class="chave__vagas">
        ${listaCandidatos(chave.melhor, chave.candidatosMelhor, times)}
        ${listaCandidatos(chave.pior, chave.candidatosPior, times)}
      </div>
      <p class="chave__subtitulo">Confrontos mais prováveis</p>`}
      <ol class="chave__duplas">${duplas}</ol>
    </article>`;
}

// O bloco do playoff inteiro: os dois confrontos e a regra.
export function blocoPlayoff(chaves, times) {
  if (chaves.length === 0) return "";
  return `
    <div class="playoff">
      <h3 class="playoff__titulo">Playoff do acesso</h3>
      <p class="playoff__regra">Dois confrontos de ida e volta valem as duas últimas vagas na Série A. A ida é na casa do
        pior colocado e a volta, na do melhor. Passa quem somar mais pontos nos dois jogos; se empatar, vale o saldo
        de gols; se ainda empatar, passa quem terminou mais bem colocado. Não tem pênaltis.</p>
      <div class="playoff__chaves">${chaves.map((c) => quadroChave(c, times)).join("")}</div>
    </div>`;
}
