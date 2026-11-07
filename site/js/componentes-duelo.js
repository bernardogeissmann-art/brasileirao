// componentes-duelo.js
// Os pedaços de tela da parte "Na disputa", que aparece nas páginas de campeonatos com mata-mata
// enquanto ele está rolando: um painel para cada confronto em aberto, com um lado para cada time
// (nas cores do clube) e, no meio, o próximo jogo e o confronto em números.
// A lógica (quem está na disputa, campanhas, caminhos) fica em estaduais/mata-mata.js; aqui só
// se monta o HTML.

import {
  escudo, escaparHtml, formatarChance, anelChance, barraResultado, formaRecente as quadradinhos, apelidoDoCanal,
  botaoIngresso,
} from "./componentes.js";
import { descreverFase } from "./estaduais/mata-mata.js";

// O texto do anel "chance de passar desta fase".
const ROTULO_AVANCAR = {
  "quinta-fase": "Passar da 5ª fase", playoffs: "Passar dos playoffs", oitavas: "Passar das oitavas", quartas: "Passar das quartas", semifinal: "Chegar à final",
};

// Cor do texto que fica legível sobre uma cor de fundo: branco sobre cores escuras, quase preto
// sobre cores claras (pela "luminância", o quanto a cor parece clara aos olhos).
function textoSobre(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#14161a" : "#ffffff";
}

// As cores de um time (de data/cores-times.json), como variáveis de CSS. Sem cores cadastradas,
// o painel fica com as cores do site.
function estiloDasCores(cores) {
  if (!cores) return "";
  return `--cor-time: ${cores.principal}; --cor-time-2: ${cores.secundaria}; --cor-sobre-time: ${textoSobre(cores.principal)};` +
    ` --cor-time-grafico: ${cores.grafico};`;
}

const umaCasa = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// O "caminho até aqui" de um time: a 1ª fase (ou de onde ele veio) e cada mata-mata vencido.
function listaDoCaminho(caminho, times) {
  return caminho.map((etapa) => {
    const texto = etapa.adversario
      ? `${escaparHtml(times[etapa.adversario].nome)} · <b>${etapa.golsPro} x ${etapa.golsContra}</b>` +
        `${etapa.jogos > 1 ? " no placar somado" : ""}${etapa.penaltis ? ` (pênaltis ${etapa.penaltis})` : ""}`
      : escaparHtml(etapa.texto);
    return `<li class="caminho__etapa"><span class="caminho__fase">${escaparHtml(etapa.fase)}</span><span class="caminho__texto">${texto}</span></li>`;
  }).join("");
}

// Um lado do painel: o time, nas cores dele.
//   lado: { id, time, cores, titulo, avancar: { fase, valor } ou null, forma, caminho, temVideos }
export function painelTime(lado, times) {
  const { id, time, cores, titulo, avancar, forma, caminho, temVideos } = lado;
  const nome = escaparHtml(time.nome);
  const corDoAnel = cores?.grafico ?? "var(--cor-titulo)";
  const aneis = [
    avancar && anelChance({ rotulo: ROTULO_AVANCAR[avancar.fase] ?? "Passar de fase", valor: avancar.valor, cor: corDoAnel }),
    anelChance({ rotulo: "Título", valor: titulo, cor: corDoAnel }),
  ].filter(Boolean).join("");
  return `
    <section class="duelo__time" style="${estiloDasCores(cores)}" aria-label="${nome}">
      <div class="duelo__faixa">
        ${escudo(time, "duelo__escudo")}
        <div>
          <h3 class="duelo__nome">${nome}</h3>
          ${time.pais ? `<p class="duelo__pais">${escaparHtml(time.pais)}</p>` : ""}
        </div>
      </div>
      <div class="duelo__corpo">
        <div class="duelo__aneis">${aneis}</div>
        <div class="duelo__bloco">
          <h4 class="duelo__subtitulo">Últimos jogos</h4>
          ${quadradinhos(forma) || "<p class=\"duelo__vazio\">Ainda não jogou.</p>"}
        </div>
        <div class="duelo__bloco">
          <h4 class="duelo__subtitulo">Caminho até aqui</h4>
          <ol class="caminho">${listaDoCaminho(caminho, times)}</ol>
        </div>
        ${temVideos ? `
        <div class="duelo__bloco duelo__videos" data-videos="${escaparHtml(id)}">
          <h4 class="duelo__subtitulo">Vídeos</h4>
          <button type="button" class="duelo__botao-videos" data-time="${escaparHtml(id)}">
            <span aria-hidden="true">▶</span> Ver os vídeos do ${nome}
          </button>
        </div>` : ""}
      </div>
    </section>`;
}

// O player do YouTube que entra no lugar do botão "Ver os vídeos".
export function playerDeVideos({ player, link }, nomeDoTime) {
  return `
    <div class="duelo__player">
      <iframe src="${player}" title="Vídeos do ${escaparHtml(nomeDoTime)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
    <a class="duelo__link-video" href="${link.endereco}" target="_blank" rel="noopener noreferrer">
      ${link.texto}<span aria-hidden="true"> ↗</span><span class="so-leitor"> (abre em outra aba)</span></a>`;
}

// Quando é o jogo: "sábado, 21 de novembro, às 19h30".
function quandoE(data) {
  const momento = new Date(data);
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(momento);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
    .format(momento).replace(":", "h");
  return `${dia}, às ${hora}`;
}

// O selo do topo: quanto falta, ou o placar ao vivo.
function seloDoJogo(estado, dias, nomes) {
  if (estado.situacao === "andamento" || estado.situacao === "intervalo") {
    const placar = estado.gols ? ` · ${nomes[0]} ${estado.gols[0]} x ${estado.gols[1]} ${nomes[1]}` : "";
    const quando = estado.situacao === "intervalo" ? "Intervalo" : `Ao vivo${estado.minuto ? ` · ${escaparHtml(estado.minuto)}` : ""}`;
    return `<span class="duelo__selo duelo__selo--agora">${quando}${escaparHtml(placar)}</span>`;
  }
  if (estado.situacao === "aguardando") return `<span class="duelo__selo">Já começou · placar em instantes</span>`;
  const texto = dias <= 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Faltam ${dias} dias`;
  return `<span class="duelo__selo">${texto}</span>`;
}

// Uma linha da comparação "campanha no campeonato": valor do time A, o que é, valor do time B.
// "melhor": "maior" quando o número maior é o melhor (gols marcados), "menor" quando é o menor
// (gols sofridos) e null quando nenhum dos dois é melhor (número de jogos). O melhor fica em destaque.
function linhaComparacao(rotulo, a, b, texto, melhor = "maior") {
  const melhorA = melhor === "maior" ? a > b : melhor === "menor" ? a < b : false;
  const melhorB = melhor === "maior" ? b > a : melhor === "menor" ? b < a : false;
  return `
    <tr>
      <td class="comparacao__valor${melhorA ? " comparacao__valor--melhor" : ""}">${texto(a)}</td>
      <th class="comparacao__rotulo" scope="row">${rotulo}</th>
      <td class="comparacao__valor${melhorB ? " comparacao__valor--melhor" : ""}">${texto(b)}</td>
    </tr>`;
}

// O painel de um confronto em aberto (ou que acabou de acabar).
//   confronto: o que confrontosAtuais() devolve para ele
//   ladoA, ladoB: veja painelTime(); cada um também traz "campanha" (campanhaDoTime)
//   chancesJogo: chancesDoJogo() do próximo jogo (ou null)
//   estado: situacaoComPlacar() do próximo jogo (ou null)
//   dias: quantos dias faltam para o próximo jogo
//   ingresso: (opcional) a loja de ingressos do mandante do próximo jogo (some na hora do jogo)
export function painelConfronto({ confronto, ladoA, ladoB, chancesJogo, estado, dias, times, ingresso }) {
  const { proximo, vencedor, placar, fase } = confronto;
  const [a, b] = [ladoA.time.nome, ladoB.time.nome];
  const referencia = proximo ?? confronto.jogos.at(-1);
  const jaJogados = confronto.jogos.filter((j) => j.disputado);

  // Topo: a fase, quando e onde, e quanto falta (ou o resultado, se acabou).
  let topo;
  if (vencedor) {
    const campeao = fase === "final";
    topo = `
      <p class="duelo__fase">${escaparHtml(nomeDaFase(referencia))}</p>
      <p class="duelo__quando"><strong>Encerrado: ${escaparHtml(a)} ${placar[ladoA.id]} x ${placar[ladoB.id]} ${escaparHtml(b)}</strong></p>
      <span class="duelo__selo duelo__selo--fim">${campeao ? "Campeão" : "Classificado"}: ${escaparHtml(times[vencedor].nome)}</span>
      <p class="duelo__regra">As chances do site ainda não incluem este resultado: elas são recalculadas na próxima atualização.</p>`;
  } else {
    const canais = proximo?.transmissao?.length
      ? proximo.transmissao.map((c) => `<li class="canal canal--${apelidoDoCanal(c)}">${escaparHtml(c)}</li>`).join("")
      : `<li class="canal canal--vazio">ainda não divulgado</li>`;
    const somado = jaJogados.length > 0
      ? `<p class="duelo__regra">Placar somado até aqui: <b>${escaparHtml(a)} ${placar[ladoA.id]} x ${placar[ladoB.id]} ${escaparHtml(b)}</b>.</p>`
      : "";
    const regra = proximo?.neutro || (fase === "final" && confronto.jogos.length === 1)
      ? `<p class="duelo__regra">Empate nos 90 minutos: prorrogação e, se continuar, pênaltis.</p>`
      : confronto.jogos.length > 1 ? `<p class="duelo__regra">Empate no placar somado: pênaltis.</p>` : "";
    topo = proximo
      ? `
      <p class="duelo__fase">${escaparHtml(descreverFase(proximo))}</p>
      <p class="duelo__quando"><strong>${escaparHtml(quandoE(proximo.data))}</strong>${proximo.estadio ? ` · ${escaparHtml(proximo.estadio)}` : ""}</p>
      ${seloDoJogo(estado, dias, [a, b])}
      ${somado}${regra}
      <div class="duelo__onde"><span class="duelo__onde-rotulo">Onde assistir</span><ul class="canais">${canais}</ul></div>
      ${ingresso ? botaoIngresso(ingresso, times[proximo.mandante].nome) : ""}`
      : `<p class="duelo__fase">${escaparHtml(nomeDaFase(referencia))}</p><p class="duelo__quando">Próximo jogo ainda sem data.</p>${somado}`;
  }

  // Meio: o próximo jogo pelo modelo e a comparação das campanhas.
  let previsao = "";
  if (chancesJogo && !vencedor) {
    const p = chancesJogo.placarMaisProvavel;
    previsao = `
      <h4 class="duelo__subtitulo">O próximo jogo, pelo modelo${estado && estado.situacao !== "antes" ? " (chances de antes do jogo)" : ""}</h4>
      ${barraResultado({ nomeMandante: a, nomeVisitante: b, vitoriaM: chancesJogo.vitoriaM, empate: chancesJogo.empate, vitoriaV: chancesJogo.vitoriaV })}
      <ul class="duelo__legenda">
        <li><span class="legenda__cor" style="--cor: var(--cor-mandante)"></span>${escaparHtml(proximo.mandante === ladoA.id ? a : b)}</li>
        <li><span class="legenda__cor" style="--cor: var(--cor-empate)"></span>Empate nos 90 minutos</li>
        <li><span class="legenda__cor" style="--cor: var(--cor-visitante)"></span>${escaparHtml(proximo.mandante === ladoA.id ? b : a)}</li>
      </ul>
      <p class="duelo__previsao">
        <span>Placar mais provável <b>${p.gols_mandante} × ${p.gols_visitante}</b></span>
        <span>Gols esperados <b>${umaCasa(chancesJogo.mediaM)} × ${umaCasa(chancesJogo.mediaV)}</b></span>
      </p>`;
  }
  const [ca, cb] = [ladoA.campanha, ladoB.campanha];
  const porJogo = (gols, jogos) => (jogos ? gols / jogos : 0);
  const comparacao = `
    <h4 class="duelo__subtitulo">Campanha no campeonato</h4>
    <table class="comparacao">
      <thead><tr><th scope="col">${escaparHtml(a)}</th><th scope="col"><span class="so-leitor">Item</span></th><th scope="col">${escaparHtml(b)}</th></tr></thead>
      <tbody>
        ${linhaComparacao("Jogos", ca.jogos, cb.jogos, String, null)}
        ${linhaComparacao("Vitórias", ca.vitorias, cb.vitorias, String)}
        ${linhaComparacao("Empates", ca.empates, cb.empates, String, null)}
        ${linhaComparacao("Derrotas", ca.derrotas, cb.derrotas, String, "menor")}
        ${linhaComparacao("Gols marcados por jogo", porJogo(ca.golsPro, ca.jogos), porJogo(cb.golsPro, cb.jogos), umaCasa)}
        ${linhaComparacao("Gols sofridos por jogo", porJogo(ca.golsContra, ca.jogos), porJogo(cb.golsContra, cb.jogos), umaCasa, "menor")}
        ${linhaComparacao("Aproveitamento", ca.aproveitamento, cb.aproveitamento, formatarChance)}
      </tbody>
    </table>
    <p class="duelo__nota">Aproveitamento: pontos ganhos ÷ pontos disputados, contando todas as fases (decisão por pênaltis conta como empate).</p>`;

  return `
    <article class="duelo">
      <header class="duelo__topo">${topo}</header>
      <div class="duelo__times">
        ${painelTime(ladoA, times)}
        <div class="duelo__x" aria-hidden="true">×</div>
        ${painelTime(ladoB, times)}
      </div>
      <section class="duelo__numeros" aria-label="O confronto em números">
        ${previsao}
        ${comparacao}
      </section>
    </article>`;
}

// O nome da fase de um jogo, sem "ida/volta" (para confrontos sem próximo jogo).
function nomeDaFase(jogo) {
  return descreverFase({ ...jogo, perna: null });
}

// Um time na disputa que ainda não sabe quem vai enfrentar.
export function painelSemAdversario(lado, times) {
  return `
    <article class="duelo duelo--sozinho">
      <header class="duelo__topo">
        <p class="duelo__fase">Já classificado</p>
        <p class="duelo__quando">Aguardando o adversário da próxima fase.</p>
      </header>
      <div class="duelo__times">${painelTime(lado, times)}</div>
    </article>`;
}
