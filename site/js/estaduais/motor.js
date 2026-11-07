// motor.js
// Peças genéricas para simular campeonatos estaduais (fase de pontos, mata-mata de
// um ou dois jogos, pênaltis, quadrangular, campanha). Cada campeonato monta o seu
// formato juntando estas peças (veja catarinense-2026.js e gaucho-2026.js).
//
// Ideia principal: num "momento" do campeonato (ex.: após a 3ª rodada), os jogos que já
// aconteceram usam o placar real; todos os outros são sorteados com o modelo daquele momento.
//
// Por velocidade (são dezenas de milhares de campeonatos simulados), os times são tratados
// por números (0, 1, 2...) e as listas de trabalho são reaproveitadas de uma simulação para outra.

import { chancesAcumuladas, sortearGols, criarSorteador } from "../simulacao.js";

export const N_SIMULACOES_ESTADUAL = 10_000;


// ---------------------------------------------------------------------------
// PREPARAR UM MOMENTO (feito uma vez; depois serve para milhares de simulações)
// ---------------------------------------------------------------------------

export function prepararMomento(dados, momento) {
  const ids = Object.keys(dados.times);
  const n = ids.length;
  const numero = new Map(ids.map((id, i) => [id, i]));   // "barra" -> 1, por exemplo
  const ate = momento.ate;

  // Jogos reais conhecidos neste momento, por fase:
  //   reais[fase][m * n + v] = o jogo real com mandante m e visitante v (ou nada)
  //   reaisDoPar[fase][menor * n + maior] = jogos reais entre os dois, em ordem de data
  const reais = new Map();
  const reaisDoPar = new Map();
  const conhecidos = dados.jogos
    .filter((j) => j.disputado && ate !== null && j.data <= ate)
    .sort((a, b) => a.data.localeCompare(b.data));
  for (const j of conhecidos) {
    const m = numero.get(j.mandante);
    const v = numero.get(j.visitante);
    const jogo = { m, v, gm: j.gols_mandante, gv: j.gols_visitante,
      pm: j.penaltis_mandante, pv: j.penaltis_visitante };
    if (!reais.has(j.fase)) { reais.set(j.fase, []); reaisDoPar.set(j.fase, []); }
    reais.get(j.fase)[m * n + v] = jogo;
    const par = Math.min(m, v) * n + Math.max(m, v);
    (reaisDoPar.get(j.fase)[par] ??= []).push(jogo);   // "??=" cria a lista se ainda não existe
  }

  // Grupos da 1ª fase, como listas de números.
  const grupos = {};
  ids.forEach((id, i) => (grupos[dados.times[id].grupo] ??= []).push(i));

  // "Roletas" de gols de cada mandante x visitante, calculadas só quando forem usadas.
  // Há quatro tipos: jogo normal; jogo em campo neutro (sem fator casa, como a final da
  // Sul-Americana); e a prorrogação (30 minutos = 1/3 das médias de gols) de cada um deles.
  const roletas = [new Array(n * n), new Array(n * n), new Array(n * n), new Array(n * n)];
  const { fator_casa: h, times: forca } = momento;
  function roleta(m, v, neutro = false, prorrogacao = false) {
    const tipo = (neutro ? 1 : 0) + (prorrogacao ? 2 : 0);
    const chave = m * n + v;
    if (!roletas[tipo][chave]) {
      const fm = forca[ids[m]];
      const fv = forca[ids[v]];
      const casa = neutro ? 1 : h;
      const tempo = prorrogacao ? 1 / 3 : 1;
      roletas[tipo][chave] = [chancesAcumuladas(fm.ataque * fv.defesa * casa * tempo),
        chancesAcumuladas(fv.ataque * fm.defesa * tempo)];
    }
    return roletas[tipo][chave];
  }

  // O calendário de cada fase que tem tabela pronta (ex.: a 1ª fase), em números.
  function calendario(fase) {
    return dados.jogos.filter((j) => j.fase === fase).map((j) => [numero.get(j.mandante), numero.get(j.visitante)]);
  }

  // Os confrontos de uma fase de mata-mata como estão no arquivo de jogos (já sorteados), cada um
  // como [quem joga em casa a ida, quem joga em casa a volta] (ou [mandante, visitante] num jogo único).
  function confrontosDaFase(fase) {
    const primeiroJogo = new Map();
    for (const j of [...dados.jogos].sort((a, b) => a.data.localeCompare(b.data))) {
      if (j.fase === fase && !primeiroJogo.has(j.confronto)) primeiroJogo.set(j.confronto, j);
    }
    return [...primeiroJogo.values()].map((j) => [numero.get(j.mandante), numero.get(j.visitante)]);
  }

  return {
    ids, n, numero, grupos, calendario, roleta, confrontosDaFase,
    // Já houve algum jogo real desta fase neste momento? (ex.: o sorteio do mata-mata já foi feito)
    temJogosReais: (fase) => reais.has(fase),
    real: (fase, m, v) => reais.get(fase)?.[m * n + v],
    reaisDoConfronto: (fase, a, b) => reaisDoPar.get(fase)?.[Math.min(a, b) * n + Math.max(a, b)] ?? [],
  };
}


// ---------------------------------------------------------------------------
// O SIMULADOR: um "final de campeonato" por vez, reaproveitando as listas de trabalho
// ---------------------------------------------------------------------------

function criarPlacar(n) {
  return { pontos: new Int32Array(n), vitorias: new Int32Array(n), saldo: new Int32Array(n), golsPro: new Int32Array(n) };
}

function zerarPlacar(p) {
  p.pontos.fill(0); p.vitorias.fill(0); p.saldo.fill(0); p.golsPro.fill(0);
}

function somarNoPlacar(p, time, gp, gc) {
  p.golsPro[time] += gp;
  p.saldo[time] += gp - gc;
  if (gp > gc) { p.pontos[time] += 3; p.vitorias[time]++; } else if (gp === gc) p.pontos[time] += 1;
}

export function criarSimulador(camp, sorteioGols, sorteioDesempate) {
  const { n } = camp;
  // Campanha: tudo somado em TODAS as fases. Decide o mando de campo no mata-mata e o
  // chaveamento quando o regulamento manda usar a "melhor campanha".
  const campanha = criarPlacar(n);
  const fases = new Map();   // fase -> { placar da fase, lista de resultados }
  const avisos = new Set();  // usado nos testes: diferenças entre a nossa regra e a realidade

  function daFase(fase) {
    if (!fases.has(fase)) fases.set(fase, { placar: criarPlacar(n), resultados: [] });
    return fases.get(fase);
  }

  // Começa um campeonato novo, do zero.
  function reiniciar() {
    zerarPlacar(campanha);
    for (const f of fases.values()) { zerarPlacar(f.placar); f.resultados.length = 0; }
  }

  // Joga uma partida: placar real se já aconteceu no momento; senão, sorteado pelo modelo.
  // Os dois lados são sempre sorteados (mesmo num jogo real) para que a sequência de
  // sorteios dos outros jogos não dependa de quais jogos já aconteceram.
  // "neutro": jogo em campo neutro (sem fator casa).
  function jogar(fase, m, v, neutro = false) {
    const [roletaM, roletaV] = camp.roleta(m, v, neutro);
    let gm = sortearGols(roletaM, sorteioGols);
    let gv = sortearGols(roletaV, sorteioGols);
    const real = camp.real(fase, m, v);
    if (real) { gm = real.gm; gv = real.gv; }
    const f = daFase(fase);
    somarNoPlacar(f.placar, m, gm, gv);
    somarNoPlacar(f.placar, v, gv, gm);
    somarNoPlacar(campanha, m, gm, gv);
    somarNoPlacar(campanha, v, gv, gm);
    f.resultados.push(m, v, gm, gv);   // guardado "achatado": 4 números por jogo
    return { m, v, gm, gv, real };
  }

  // Ordena times por pontos (+ bônus), vitórias, saldo e gols pró. Empates totais:
  // confronto direto (se pedido e se forem só 2 times) e, por fim, sorteio
  // (no lugar dos cartões e do sorteio do regulamento).
  function ordenarPor(placar, times, bonus, fase) {
    const pontos = (t) => placar.pontos[t] + (bonus?.[t] ?? 0);
    const comparar = (a, b) => (pontos(b) - pontos(a)) || (placar.vitorias[b] - placar.vitorias[a])
      || (placar.saldo[b] - placar.saldo[a]) || (placar.golsPro[b] - placar.golsPro[a]);
    const ordem = [...times].sort(comparar);

    // Procura grupos de times empatados em tudo e resolve cada um.
    for (let i = 0; i < ordem.length; ) {
      let fim = i + 1;
      while (fim < ordem.length && comparar(ordem[i], ordem[fim]) === 0) fim++;
      if (fim - i === 2 && fase) {
        const diferenca = confrontoDireto(fase, ordem[i], ordem[i + 1]);
        if (diferenca < 0) [ordem[i], ordem[i + 1]] = [ordem[i + 1], ordem[i]];
        else if (diferenca === 0) embaralhar(ordem, i, fim);
      } else if (fim - i > 1) {
        embaralhar(ordem, i, fim);
      }
      i = fim;
    }
    return ordem;
  }

  // Pontos de "a" menos pontos de "b" nos jogos entre os dois, numa fase.
  function confrontoDireto(fase, a, b) {
    const r = daFase(fase).resultados;
    let saldo = 0;
    for (let k = 0; k < r.length; k += 4) {
      const [m, v, gm, gv] = [r[k], r[k + 1], r[k + 2], r[k + 3]];
      if (!((m === a && v === b) || (m === b && v === a))) continue;
      const pm = gm > gv ? 3 : gm === gv ? 1 : 0;
      const pv = gv > gm ? 3 : gm === gv ? 1 : 0;
      saldo += m === a ? pm - pv : pv - pm;
    }
    return saldo;
  }

  // Sorteio entre empatados (embaralha o trecho [inicio, fim) da lista).
  function embaralhar(lista, inicio, fim) {
    for (let i = fim - 1; i > inicio; i--) {
      const j = inicio + Math.floor(sorteioDesempate() * (i - inicio + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
  }

  // Tabela de uma fase de pontos (ou de um grupo dela), já ordenada.
  //   bonus: pontos extras por time (ex.: { [figueirense]: 1 })
  //   confrontoDireto: usar o confronto direto quando exatamente 2 times empatam em tudo
  function classificar(times, fase, { bonus = null, confrontoDireto = false } = {}) {
    return ordenarPor(daFase(fase).placar, times, bonus, confrontoDireto ? fase : null);
  }

  // Ordena times pela campanha somada (todas as fases até agora).
  function ordenarPorCampanha(times) {
    return ordenarPor(campanha, times, null, null);
  }

  // Tabela de um grupo pelas regras da CONMEBOL (Libertadores e Sul-Americana 2026): pontos;
  // entre os empatados, os jogos entre eles (pontos, saldo e gols); depois saldo e gols no
  // grupo todo; por fim, sorteio (no lugar dos cartões, que não dá para prever).
  function classificarConmebol(times, fase) {
    const p = daFase(fase).placar;
    const ordem = [...times].sort((a, b) => p.pontos[b] - p.pontos[a]);
    for (let i = 0; i < ordem.length; ) {
      let fim = i + 1;
      while (fim < ordem.length && p.pontos[ordem[fim]] === p.pontos[ordem[i]]) fim++;
      if (fim - i > 1) desempatarConmebol(fase, ordem, i, fim);
      i = fim;
    }
    return ordem;
  }

  // Desempata o trecho [inicio, fim) da lista (times com os mesmos pontos).
  function desempatarConmebol(fase, ordem, inicio, fim) {
    const empatados = ordem.slice(inicio, fim);
    // Mini tabela só com os jogos entre os empatados: [pontos, saldo, gols].
    const mini = new Map(empatados.map((t) => [t, [0, 0, 0]]));
    const r = daFase(fase).resultados;
    for (let k = 0; k < r.length; k += 4) {
      const [m, v, gm, gv] = [r[k], r[k + 1], r[k + 2], r[k + 3]];
      if (!mini.has(m) || !mini.has(v)) continue;
      for (const [eu, gp, gc] of [[m, gm, gv], [v, gv, gm]]) {
        const linha = mini.get(eu);
        linha[0] += gp > gc ? 3 : gp === gc ? 1 : 0;
        linha[1] += gp - gc;
        linha[2] += gp;
      }
    }
    const p = daFase(fase).placar;
    const criterios = (t) => [...mini.get(t), p.saldo[t], p.golsPro[t]];
    const comparar = (a, b) => {
      const ca = criterios(a);
      const cb = criterios(b);
      for (let i = 0; i < ca.length; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i];
      return 0;
    };
    empatados.sort(comparar);
    // Quem continua empatado em tudo vai para o sorteio.
    for (let i = 0; i < empatados.length; ) {
      let j = i + 1;
      while (j < empatados.length && comparar(empatados[i], empatados[j]) === 0) j++;
      if (j - i > 1) embaralhar(empatados, i, j);
      i = j;
    }
    ordem.splice(inicio, empatados.length, ...empatados);
  }

  // Ordena times de grupos diferentes (ex.: os 8 primeiros colocados) pela campanha numa fase:
  // pontos, saldo e gols; empate em tudo, sorteio. É a "numeração" da CONMEBOL, que decide quem
  // joga a volta em casa no mata-mata.
  function ordenarEntreGrupos(times, fase) {
    const p = daFase(fase).placar;
    const comparar = (a, b) => (p.pontos[b] - p.pontos[a]) || (p.saldo[b] - p.saldo[a]) || (p.golsPro[b] - p.golsPro[a]);
    const ordem = [...times].sort(comparar);
    for (let i = 0; i < ordem.length; ) {
      let fim = i + 1;
      while (fim < ordem.length && comparar(ordem[i], ordem[fim]) === 0) fim++;
      if (fim - i > 1) embaralhar(ordem, i, fim);
      i = fim;
    }
    return ordem;
  }

  // Embaralha uma lista inteira (usado para imitar um sorteio de chaves). Devolve uma cópia.
  function sortear(lista) {
    const copia = [...lista];
    embaralhar(copia, 0, copia.length);
    return copia;
  }

  // Confronto de mata-mata entre "a" e "b".
  //   pernas: 1 (jogo único) ou 2 (ida e volta)
  //   mandante: em jogo único, quem joga em casa. Em ida e volta, a melhor campanha
  //             joga a volta em casa (como nos regulamentos de 2026).
  //   casaDaVolta: (opcional) em ida e volta, quem joga a volta em casa, quando o regulamento
  //                usa outra regra (ex.: a "numeração" da CONMEBOL).
  //   neutro: jogo único em campo neutro (sem fator casa), como a final da Sul-Americana.
  //   prorrogacao: em jogo único, empate leva a 30 minutos de prorrogação antes dos pênaltis.
  // Empate (no jogo único ou no agregado) vai para os pênaltis: 50% para cada lado.
  function confronto(fase, a, b, { pernas = 2, mandante = null, casaDaVolta = null, neutro = false, prorrogacao = false } = {}) {
    const reaisDoConfronto = camp.reaisDoConfronto(fase, a, b);
    let jogos;
    if (pernas === 1) {
      const casa = reaisDoConfronto[0]?.m ?? mandante ?? a;
      jogos = [jogar(fase, casa, casa === a ? b : a, neutro)];
    } else {
      const melhor = casaDaVolta ?? ordenarPorCampanha([a, b])[0];
      let casaVolta = melhor;
      if (reaisDoConfronto.length > 0) {
        // Se o confronto já começou de verdade, vale o mando real.
        const [ida, volta] = reaisDoConfronto;
        const casaVoltaReal = volta ? volta.m : (ida.m === a ? b : a);
        if (casaVoltaReal !== melhor) avisos.add(`${fase}: mando real ${casaVoltaReal}, regra dizia ${melhor}`);
        casaVolta = casaVoltaReal;
      }
      const casaIda = casaVolta === a ? b : a;
      jogos = [jogar(fase, casaIda, casaVolta), jogar(fase, casaVolta, casaIda)];
    }

    let golsA = 0;
    let golsB = 0;
    for (const j of jogos) {
      golsA += j.m === a ? j.gm : j.gv;
      golsB += j.m === a ? j.gv : j.gm;
    }
    // Prorrogação (só em jogo único e só se o jogo ainda não aconteceu: o placar real já
    // inclui os gols da prorrogação).
    const unico = jogos[0];
    if (prorrogacao && pernas === 1 && golsA === golsB && !unico.real) {
      const [roletaM, roletaV] = camp.roleta(unico.m, unico.v, neutro, true);
      const extraM = sortearGols(roletaM, sorteioGols);
      const extraV = sortearGols(roletaV, sorteioGols);
      golsA += unico.m === a ? extraM : extraV;
      golsB += unico.m === a ? extraV : extraM;
    }
    let vencedor;
    if (golsA !== golsB) {
      vencedor = golsA > golsB ? a : b;
    } else {
      const decisivo = jogos[jogos.length - 1];
      if (decisivo.real && decisivo.real.pm !== null) {
        vencedor = decisivo.real.pm > decisivo.real.pv ? decisivo.m : decisivo.v;
      } else {
        vencedor = sorteioDesempate() < 0.5 ? a : b;
      }
    }
    return { vencedor, perdedor: vencedor === a ? b : a };
  }

  // Joga todos os jogos de uma fase que tem calendário pronto (ex.: a 1ª fase).
  function jogarCalendario(fase) {
    for (const [m, v] of camp.calendario(fase)) jogar(fase, m, v);
  }

  // Todos contra todos, ida e volta, entre os times indicados (ex.: quadrangular).
  function todosContraTodos(fase, times) {
    for (const m of times) {
      for (const v of times) {
        if (m !== v) jogar(fase, m, v);
      }
    }
  }

  return {
    reiniciar, jogar, jogarCalendario, classificar, ordenarPorCampanha, confronto, todosContraTodos, avisos,
    classificarConmebol, ordenarEntreGrupos, sortear,
  };
}


// ---------------------------------------------------------------------------
// MUITAS SIMULAÇÕES: transforma os resultados em probabilidades
// ---------------------------------------------------------------------------

// Simula um momento N vezes e conta quantas vezes cada time alcançou cada resultado.
export function simularMomento(dados, momento, formato, { n = N_SIMULACOES_ESTADUAL, semente = 1 } = {}) {
  const camp = prepararMomento(dados, momento);
  // O calendário da 1ª fase é preparado uma vez só (e não a cada simulação).
  const calendarios = new Map();
  const campComCache = { ...camp, calendario: (fase) => {
    if (!calendarios.has(fase)) calendarios.set(fase, camp.calendario(fase));
    return calendarios.get(fase);
  } };
  const sim = criarSimulador(campComCache, criarSorteador(semente), criarSorteador(semente + 1));
  const campos = formato.resultados.map((r) => r.campo);
  const contagem = Object.fromEntries(campos.map((c) => [c, new Int32Array(camp.n)]));

  for (let s = 0; s < n; s++) {
    sim.reiniciar();
    const resultado = formato.simular(sim, campComCache);
    for (const campo of campos) {
      for (const time of resultado[campo]) contagem[campo][time]++;
    }
  }

  const times = {};
  camp.ids.forEach((id, t) => {
    times[id] = Object.fromEntries(campos.map((c) => [c, contagem[c][t] / n]));
  });
  return { momento: momento.id, simulacoes: n, times, avisos: [...sim.avisos] };
}

// Tabela real de um grupo da 1ª fase num momento (só para mostrar na tela).
//   conmebol: desempatar pelas regras da CONMEBOL (primeiro os jogos entre os empatados)
//   todasAsFases: somar os jogos de todas as fases (ex.: os times que vieram da Libertadores,
//                 que não jogaram a fase de grupos da Sul-Americana)
export function tabelaDoGrupo(dados, momento, grupo, { conmebol = false, todasAsFases = false } = {}) {
  const ate = momento.ate;
  const ids = Object.keys(dados.times).filter((id) => dados.times[id].grupo === grupo);
  const linhas = new Map(ids.map((id) => [id, { id, pontos: 0, jogos: 0, vitorias: 0, saldo: 0, golsPro: 0 }]));
  const jogosDaTabela = [];
  for (const j of dados.jogos) {
    if ((!todasAsFases && j.fase !== "primeira-fase") || !j.disputado || ate === null || j.data > ate) continue;
    jogosDaTabela.push(j);
    for (const [eu, gp, gc] of [[j.mandante, j.gols_mandante, j.gols_visitante],
                                [j.visitante, j.gols_visitante, j.gols_mandante]]) {
      const l = linhas.get(eu);
      if (!l) continue;   // o adversário é do outro grupo: o jogo conta só para quem é deste grupo
      l.jogos++;
      l.golsPro += gp;
      l.saldo += gp - gc;
      if (gp > gc) { l.pontos += 3; l.vitorias++; } else if (gp === gc) l.pontos += 1;
    }
  }
  // Sem sorteio aqui: empates totais ficam em ordem alfabética, para a tela não "pular".
  const comparar = conmebol
    ? (a, b) => (b.pontos - a.pontos) || compararConfrontoDireto(a, b) || (b.saldo - a.saldo)
      || (b.golsPro - a.golsPro) || a.id.localeCompare(b.id)
    : (a, b) => (b.pontos - a.pontos) || (b.vitorias - a.vitorias) || (b.saldo - a.saldo)
      || (b.golsPro - a.golsPro) || a.id.localeCompare(b.id);

  // Regra da CONMEBOL: entre os times com os mesmos pontos, valem primeiro os jogos entre eles
  // (pontos, saldo e gols nesses jogos).
  function compararConfrontoDireto(a, b) {
    const empatados = new Set([...linhas.values()].filter((l) => l.pontos === a.pontos).map((l) => l.id));
    const mini = (id) => {
      const conta = [0, 0, 0];
      for (const j of jogosDaTabela) {
        if (!empatados.has(j.mandante) || !empatados.has(j.visitante)) continue;
        if (j.mandante !== id && j.visitante !== id) continue;
        const gp = j.mandante === id ? j.gols_mandante : j.gols_visitante;
        const gc = j.mandante === id ? j.gols_visitante : j.gols_mandante;
        conta[0] += gp > gc ? 3 : gp === gc ? 1 : 0;
        conta[1] += gp - gc;
        conta[2] += gp;
      }
      return conta;
    };
    const [ma, mb] = [mini(a.id), mini(b.id)];
    return (mb[0] - ma[0]) || (mb[1] - ma[1]) || (mb[2] - ma[2]);
  }

  return [...linhas.values()]
    .sort(comparar)
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}
