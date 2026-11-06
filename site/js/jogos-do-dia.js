// jogos-do-dia.js
// A lógica da seção "Jogos do dia" da página principal (aqui não tem nada de tela):
//   - que dia é hoje, no horário de Brasília;
//   - quais jogos mostrar: os de hoje ou, se hoje não tiver jogo, os do próximo dia com jogo;
//   - a sequência recente de cada time (V = vitória, E = empate, D = derrota);
//   - em que pé o jogo está agora (vai começar, em andamento, já deve ter acabado).

const FUSO = "America/Sao_Paulo";
const DURACAO_DE_UM_JOGO = 2 * 60 * 60 * 1000;   // ~2 horas, contando o intervalo (em milésimos)

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
