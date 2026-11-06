// jogos-do-dia.js
// A lógica da seção "Jogos do dia" da página principal (aqui não tem nada de tela):
//   - que dia é hoje, no horário de Brasília;
//   - quais jogos mostrar: os de hoje ou, se hoje não tiver jogo, os do próximo dia com jogo;
//   - a sequência recente de cada time (V = vitória, E = empate, D = derrota);
//   - em que pé o jogo está agora (vai começar, em andamento, já deve ter acabado);
//   - o placar ao vivo: lido direto da ESPN pelo navegador de quem visita (a ESPN permite isso),
//     a cada minuto enquanto há jogo; se a ESPN falhar, vale o arquivo data/ao-vivo.json do site.

const FUSO = "America/Sao_Paulo";
const DURACAO_DE_UM_JOGO = 2 * 60 * 60 * 1000;   // ~2 horas, contando o intervalo (em milésimos)
const MINUTO = 60 * 1000;
// Mesma janela do scripts/placar_ao_vivo.py: de 5 minutos antes a 130 minutos depois do horário.
const JANELA_ANTES = 5 * MINUTO;
const JANELA_DEPOIS = 130 * MINUTO;

// O dia (no horário de Brasília) de um momento qualquer: "2026-11-05".
// O formato "en-CA" escreve as datas assim, ano-mês-dia, que é fácil de comparar.
export function diaEmBrasilia(momento = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(momento);
}

const diaDoJogo = (jogo) => diaEmBrasilia(new Date(jogo.data));
const porHorario = (a, b) => a.data.localeCompare(b.data);

// Quais jogos a seção mostra. Devolve { dia, eHoje, jogos } ou null (campeonato acabou).
// Jogos adiados ficam de fora: a data deles não vale mais.
export function escolherJogosDoDia(jogos, agora = new Date()) {
  const validos = jogos.filter((jogo) => jogo.status_fonte !== "POSTPONED");
  const hoje = diaEmBrasilia(agora);
  const deHoje = validos.filter((jogo) => diaDoJogo(jogo) === hoje);
  if (deHoje.length > 0) return { dia: hoje, eHoje: true, jogos: deHoje.sort(porHorario) };

  const futuros = validos.filter((jogo) => !jogo.disputado && diaDoJogo(jogo) > hoje);
  if (futuros.length === 0) return null;
  const proximoDia = futuros.map(diaDoJogo).sort()[0];
  return { dia: proximoDia, eHoje: false, jogos: futuros.filter((jogo) => diaDoJogo(jogo) === proximoDia).sort(porHorario) };
}

// Os últimos resultados de um time, do mais antigo para o mais recente: ["V", "E", "D", ...].
export function formaRecente(jogos, idTime, quantos = 5) {
  return jogos
    .filter((jogo) => jogo.disputado && (jogo.mandante === idTime || jogo.visitante === idTime))
    .sort(porHorario)
    .slice(-quantos)
    .map((jogo) => {
      const emCasa = jogo.mandante === idTime;
      const pro = emCasa ? jogo.gols_mandante : jogo.gols_visitante;
      const contra = emCasa ? jogo.gols_visitante : jogo.gols_mandante;
      return pro > contra ? "V" : pro === contra ? "E" : "D";
    });
}

// Em que pé o jogo está:
//   "encerrado"  – já tem placar no arquivo;
//   "antes"      – ainda vai começar;
//   "andamento"  – começou há menos de 2 horas;
//   "aguardando" – já deve ter acabado, mas o placar só entra na atualização da madrugada.
export function situacaoDoJogo(jogo, agora = new Date()) {
  if (jogo.disputado) return "encerrado";
  const inicio = new Date(jogo.data).getTime();
  if (agora.getTime() < inicio) return "antes";
  if (agora.getTime() < inicio + DURACAO_DE_UM_JOGO) return "andamento";
  return "aguardando";
}

const URL_ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard?dates=";

// Traduz a situação do jogo na ESPN: "antes", "andamento", "intervalo" ou "encerrado".
export function situacaoNaEspn(status) {
  const estado = status?.type?.state;   // "pre" (antes), "in" (rolando) ou "post" (acabou)
  // Jogo adiado ou cancelado também vem como "post", mas não acabou: conta como "antes".
  if (estado === "post") return /POSTPONED|CANCELED|SUSPENDED|DELAYED/.test(status.type.name ?? "") ? "antes" : "encerrado";
  if (estado === "in") return status.type.name === "STATUS_HALFTIME" ? "intervalo" : "andamento";
  return "antes";
}

// Junta os jogos da ESPN com os nossos jogos (pelo par mandante x visitante). Cada time do
// jogos.json guarda o nome dele na ESPN ("nome_espn"). Devolve { id do jogo: placar }.
export function placaresDaEspn(eventos, jogosDoDia, times) {
  const idPeloNome = new Map(Object.entries(times).filter(([, t]) => t.nome_espn).map(([id, t]) => [t.nome_espn, id]));
  const jogoDoPar = new Map(jogosDoDia.map((j) => [`${j.mandante}|${j.visitante}`, j]));
  const placares = {};
  for (const evento of eventos) {
    const competicao = evento.competitions?.[0];
    if (!competicao) continue;
    const lado = Object.fromEntries(competicao.competitors.map((c) => [c.homeAway, c]));
    const par = `${idPeloNome.get(lado.home?.team?.displayName)}|${idPeloNome.get(lado.away?.team?.displayName)}`;
    const jogo = jogoDoPar.get(par);
    const situacao = situacaoNaEspn(competicao.status);
    if (!jogo || situacao === "antes") continue;
    placares[String(jogo.id)] = {
      gols_mandante: Number(lado.home.score),
      gols_visitante: Number(lado.away.score),
      situacao,
      minuto: situacao === "andamento" ? competicao.status.displayClock ?? null : null,
    };
  }
  return placares;
}

// Placar direto da ESPN, para os jogos indicados (um pedido por dia de jogo).
async function placarDaEspn(jogosDoDia, times) {
  const dias = [...new Set(jogosDoDia.map((j) => diaEmBrasilia(new Date(j.data)).replaceAll("-", "")))];
  const eventos = [];
  for (const dia of dias) {
    // Se a ESPN não responder em 8 segundos, desiste (e vale o arquivo do site).
    const resposta = await fetch(URL_ESPN + dia, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!resposta.ok) throw new Error(`ESPN respondeu com erro ${resposta.status}`);
    eventos.push(...((await resposta.json()).events ?? []));
  }
  return { atualizado_em: new Date().toISOString(), fonte: "ESPN", jogos: placaresDaEspn(eventos, jogosDoDia, times) };
}

// Lê o placar ao vivo dos jogos que já começaram: primeiro direto da ESPN (o mais atualizado);
// se não der, o arquivo do site (o endereço ganha a hora de agora no fim, ?agora=..., para
// nunca vir de uma cópia guardada pelo navegador). Sem nenhum dos dois, devolve null.
export async function lerPlacarAoVivo(jogosComecados = [], times = {}) {
  if (jogosComecados.length > 0) {
    try {
      return await placarDaEspn(jogosComecados, times);
    } catch (erro) {
      console.warn("Placar da ESPN indisponível; usando o arquivo do site.", erro);
    }
  }
  const endereco = new URL("../../data/ao-vivo.json", import.meta.url);
  endereco.searchParams.set("agora", String(Date.now()));
  try {
    const resposta = await fetch(endereco, { cache: "no-store" });
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

// Os jogos que já começaram (ou começam em 5 minutos) nas últimas 24 horas e ainda estão sem
// resultado no jogos.json: só para eles vale perguntar o placar à ESPN.
export function jogosSemResultado(jogos, agora = new Date()) {
  return jogos.filter((jogo) => {
    if (jogo.disputado || jogo.status_fonte === "POSTPONED") return false;
    const desdeOInicio = agora.getTime() - new Date(jogo.data).getTime();
    return desdeOInicio >= -JANELA_ANTES && desdeOInicio <= 24 * 60 * MINUTO;
  });
}

// Os jogos que a ESPN já dá como encerrados passam a contar como disputados, com o placar
// final. Assim a tabela e as chances mudam assim que o jogo acaba, sem esperar a próxima
// atualização do site. Muda a própria lista de jogos e devolve quantos mudaram (0 = nenhum).
export function incluirEncerrados(jogos, aoVivo) {
  let novos = 0;
  for (const jogo of jogos) {
    const placar = aoVivo?.jogos?.[String(jogo.id)];
    if (jogo.disputado || placar?.situacao !== "encerrado") continue;
    jogo.disputado = true;
    jogo.gols_mandante = placar.gols_mandante;
    jogo.gols_visitante = placar.gols_visitante;
    novos++;
  }
  return novos;
}

// Atalho para as páginas: pergunta o placar dos jogos sem resultado e inclui os que já
// acabaram. Devolve o placar ao vivo (para os cartões) e quantos jogos mudaram.
export async function atualizarComEspn(dadosJogos) {
  const pendentes = jogosSemResultado(dadosJogos.jogos);
  if (pendentes.length === 0) return { aoVivo: null, novos: 0 };   // nada para perguntar
  const aoVivo = await lerPlacarAoVivo(pendentes, dadosJogos.times);
  return { aoVivo, novos: incluirEncerrados(dadosJogos.jogos, aoVivo) };
}

// A situação de um jogo juntando o arquivo de jogos com o placar ao vivo:
//   { situacao, gols: [mandante, visitante] (quando há placar), minuto (quando a bola rola) }.
// Ordem de confiança: placar final do jogos.json > placar ao vivo > só o relógio.
export function situacaoComPlacar(jogo, aoVivo, agora = new Date()) {
  if (jogo.disputado) return { situacao: "encerrado", gols: [jogo.gols_mandante, jogo.gols_visitante] };
  const placar = aoVivo?.jogos?.[String(jogo.id)];
  if (placar) {
    return { situacao: placar.situacao, gols: [placar.gols_mandante, placar.gols_visitante], minuto: placar.minuto ?? null };
  }
  return { situacao: situacaoDoJogo(jogo, agora) };
}

// Algum destes jogos está rolando agora (ou acabou há pouco)? Serve para a página
// buscar o placar de novo de tempos em tempos só quando faz sentido.
export function temJogoRolando(jogos, agora = new Date()) {
  return jogos.some((jogo) => {
    if (jogo.disputado) return false;
    const inicio = new Date(jogo.data).getTime();
    return agora.getTime() >= inicio - JANELA_ANTES && agora.getTime() <= inicio + JANELA_DEPOIS;
  });
}
