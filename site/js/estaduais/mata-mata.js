// mata-mata.js
// A lógica da parte "Na disputa" das páginas de campeonatos com mata-mata (Sul-Americana e
// estaduais), usada enquanto o mata-mata está rolando: quem ainda pode ser campeão, os confrontos
// em aberto, a campanha e o caminho de cada time até aqui. Aqui não tem nada de tela.

import { tabelaDoGrupo } from "./motor.js";

// O nome de cada fase, para mostrar na tela.
export const NOMES_DAS_FASES = {
  "primeira-fase": "Fase de grupos", "quinta-fase": "5ª fase", playoffs: "Playoffs", oitavas: "Oitavas de final",
  quartas: "Quartas de final", semifinal: "Semifinal", final: "Final",
};

// Qual chance quer dizer "passou desta fase": quem vence as quartas vai à semifinal, e assim por
// diante. Quem vence a final é campeão.
export const DEPOIS_DA_FASE = { "quinta-fase": "oitavas", playoffs: "oitavas", oitavas: "quartas", quartas: "semifinal", semifinal: "final", final: "titulo" };

const porData = (a, b) => a.data.localeCompare(b.data);

// "Final · jogo único em campo neutro", "Quartas de final · ida", "Fase de grupos · 3ª rodada".
export function descreverFase(jogo) {
  const nome = NOMES_DAS_FASES[jogo.fase] ?? jogo.fase;
  if (jogo.fase === "primeira-fase") return `${nome} · ${jogo.rodada}ª rodada`;
  if (jogo.neutro) return `${nome} · jogo único em campo neutro`;
  if (!jogo.perna) return nome;
  return `${nome} · ${jogo.perna === 1 ? "ida" : "volta"}`;
}

// O mata-mata está rolando? Sim quando a 1ª fase já acabou e ainda não há campeão. Num campeonato
// sem 1ª fase (a Copa do Brasil, que é mata-mata do começo ao fim), basta já ter começado.
export function mataMataEmAndamento(dados, chances) {
  const fim = chances.momentos[chances.momentos.length - 1].times;
  const temCampeao = Object.values(fim).some((t) => t.titulo === 1);
  const primeiraFase = dados.jogos.filter((j) => j.fase === "primeira-fase");
  const comecou = primeiraFase.length > 0 ? primeiraFase.every((j) => j.disputado) : dados.jogos.some((j) => j.disputado);
  return !temCampeao && comecou;
}

// Os times que ainda podem ser campeões (chance de título acima de zero no momento mais
// recente), do mais para o menos cotado.
export function timesNaDisputa(chances) {
  const fim = chances.momentos[chances.momentos.length - 1].times;
  return Object.keys(fim).filter((id) => fim[id].titulo > 0).sort((a, b) => fim[b].titulo - fim[a].titulo);
}

// Quem venceu um confronto de mata-mata que já acabou: o placar somado e, se empatar, os pênaltis
// do último jogo. Devolve o id do vencedor (ou null se ainda faltam jogos).
export function vencedorDoConfronto(jogos) {
  if (jogos.length === 0 || !jogos.every((j) => j.disputado)) return null;
  const [a, b] = [jogos[0].mandante, jogos[0].visitante];
  const gols = placarSomado(jogos);
  if (gols[a] !== gols[b]) return gols[a] > gols[b] ? a : b;
  const ultimo = [...jogos].sort(porData).at(-1);
  if (ultimo.penaltis_mandante == null) return null;   // sem a informação dos pênaltis
  return ultimo.penaltis_mandante > ultimo.penaltis_visitante ? ultimo.mandante : ultimo.visitante;
}

// Gols de cada time somados nos jogos já disputados de um confronto: { idA: 3, idB: 2 }.
function placarSomado(jogos) {
  const gols = { [jogos[0].mandante]: 0, [jogos[0].visitante]: 0 };
  for (const j of jogos) {
    if (!j.disputado) continue;
    gols[j.mandante] += j.gols_mandante;
    gols[j.visitante] += j.gols_visitante;
  }
  return gols;
}

// Os confrontos atuais dos times na disputa. O "confronto atual" de um time é o do seu próximo
// jogo ou, se não houver próximo jogo marcado, o do último jogo de mata-mata dele (assim um
// confronto que acabou agora, antes de as chances serem recalculadas, aparece como encerrado).
// Cada confronto: { fase, times: [a, b] (a = quem joga em casa o 1º jogo), jogos, placar,
// proximo (o próximo jogo, ou null), vencedor (só se já acabou) }.
// Times na disputa ainda sem adversário definido ficam em "semAdversario".
export function confrontosAtuais(dados, naDisputa) {
  const doConfronto = new Map();   // "final-boca-juniors-mineiro" -> jogos
  for (const j of dados.jogos) {
    if (j.confronto) (doConfronto.get(j.confronto) ?? doConfronto.set(j.confronto, []).get(j.confronto)).push(j);
  }
  const escolhidos = new Map();
  const semAdversario = [];
  for (const id of naDisputa) {
    const dele = dados.jogos.filter((j) => j.confronto && (j.mandante === id || j.visitante === id)).sort(porData);
    const atual = dele.find((j) => !j.disputado) ?? dele.at(-1);
    // Se o último confronto dele já acabou e ele não ganhou, as chances estão atrasadas: ignora.
    if (!atual) { semAdversario.push(id); continue; }
    const jogos = doConfronto.get(atual.confronto).sort(porData);
    const vencedor = vencedorDoConfronto(jogos);
    if (vencedor && vencedor === id && atual.fase !== "final") { semAdversario.push(id); continue; }
    if (vencedor && vencedor !== id && atual.fase !== "final") continue;
    if (!escolhidos.has(atual.confronto)) {
      escolhidos.set(atual.confronto, {
        fase: atual.fase,
        times: [jogos[0].mandante, jogos[0].visitante],
        jogos,
        placar: placarSomado(jogos),
        proximo: jogos.find((j) => !j.disputado) ?? null,
        vencedor,
      });
    }
  }
  const confrontos = [...escolhidos.values()]
    .sort((a, b) => (a.proximo?.data ?? "9").localeCompare(b.proximo?.data ?? "9"));
  return { confrontos, semAdversario };
}

// A campanha de um time em todo o campeonato (todas as fases): jogos, vitórias, empates,
// derrotas, gols e aproveitamento (pontos ganhos ÷ pontos possíveis).
export function campanhaDoTime(dados, id) {
  const c = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0 };
  for (const j of dados.jogos) {
    if (!j.disputado || (j.mandante !== id && j.visitante !== id)) continue;
    const pro = j.mandante === id ? j.gols_mandante : j.gols_visitante;
    const contra = j.mandante === id ? j.gols_visitante : j.gols_mandante;
    c.jogos++;
    c.golsPro += pro;
    c.golsContra += contra;
    if (pro > contra) c.vitorias++; else if (pro === contra) c.empates++; else c.derrotas++;
  }
  c.aproveitamento = c.jogos ? (3 * c.vitorias + c.empates) / (3 * c.jogos) : 0;
  return c;
}

// O caminho de um time até aqui: a 1ª fase (posição no grupo) ou de onde ele veio, e cada
// confronto de mata-mata já decidido. Cada etapa: { fase, texto } e, no mata-mata,
// { adversario, golsPro, golsContra, penaltis: "4 x 3" ou null, venceu }.
export function caminhoDoTime(dados, id, formato) {
  const etapas = [];
  const grupo = dados.times[id].grupo;
  const deFora = formato.origemDeFora?.[grupo];
  const primeiraFase = dados.jogos.filter((j) => j.fase === "primeira-fase");
  if (deFora) {
    etapas.push({ fase: NOMES_DAS_FASES["primeira-fase"], texto: deFora });
  } else if (primeiraFase.length > 0) {
    const ate = primeiraFase.map((j) => j.data).sort().at(-1);
    const tabela = tabelaDoGrupo(dados, { ate }, grupo, { conmebol: Boolean(formato.desempateConmebol) });
    const linha = tabela.find((l) => l.id === id);
    const nomeDoGrupo = formato.tituloGrupo ? formato.tituloGrupo(grupo) : `Grupo ${grupo}`;
    etapas.push({ fase: NOMES_DAS_FASES["primeira-fase"], texto: `${linha.posicao}º no ${nomeDoGrupo} · ${linha.pontos} pts` });
  }

  const vistos = new Set();
  for (const j of dados.jogos.filter((x) => x.confronto && (x.mandante === id || x.visitante === id)).sort(porData)) {
    if (vistos.has(j.confronto)) continue;
    vistos.add(j.confronto);
    const jogos = dados.jogos.filter((x) => x.confronto === j.confronto).sort(porData);
    const vencedor = vencedorDoConfronto(jogos);
    if (!vencedor) continue;   // ainda rolando: aparece no duelo, não no caminho
    const placar = placarSomado(jogos);
    const adversario = j.mandante === id ? j.visitante : j.mandante;
    const ultimo = jogos.at(-1);
    const empatou = placar[id] === placar[adversario];
    const penaltis = empatou && ultimo.penaltis_mandante != null
      ? (ultimo.mandante === id
        ? `${ultimo.penaltis_mandante} x ${ultimo.penaltis_visitante}`
        : `${ultimo.penaltis_visitante} x ${ultimo.penaltis_mandante}`)
      : null;
    etapas.push({ fase: NOMES_DAS_FASES[j.fase] ?? j.fase, adversario, golsPro: placar[id], golsContra: placar[adversario],
      penaltis, venceu: vencedor === id, jogos: jogos.length });
  }
  return etapas;
}

// Quantos dias faltam até um jogo, contando no horário de Brasília (0 = hoje, 1 = amanhã).
export function diasAte(dataDoJogo, agora = new Date()) {
  const dia = (momento) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(momento);
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(dia(new Date(dataDoJogo))) - Date.parse(dia(agora))) / umDia);
}
