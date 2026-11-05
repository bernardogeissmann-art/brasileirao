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
  const roletas = new Array(n * n);
  const { fator_casa: h, times: forca } = momento;
  function roleta(m, v) {
    const chave = m * n + v;
    if (!roletas[chave]) {
      const fm = forca[ids[m]];
      const fv = forca[ids[v]];
      roletas[chave] = [chancesAcumuladas(fm.ataque * fv.defesa * h), chancesAcumuladas(fv.ataque * fm.defesa)];
    }
    return roletas[chave];
  }

  // O calendário de cada fase que tem tabela pronta (ex.: a 1ª fase), em números.
  function calendario(fase) {
    return dados.jogos.filter((j) => j.fase === fase).map((j) => [numero.get(j.mandante), numero.get(j.visitante)]);
  }

  return {
    ids, n, numero, grupos, calendario, roleta,
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
  function jogar(fase, m, v) {
    const [roletaM, roletaV] = camp.roleta(m, v);
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

  // Confronto de mata-mata entre "a" e "b".
  //   pernas: 1 (jogo único) ou 2 (ida e volta)
  //   mandante: em jogo único, quem joga em casa. Em ida e volta, a melhor campanha
  //             joga a volta em casa (como nos regulamentos de 2026).
  // Empate (no jogo único ou no agregado) vai para os pênaltis: 50% para cada lado.
  function confronto(fase, a, b, { pernas = 2, mandante = null } = {}) {
    const reaisDoConfronto = camp.reaisDoConfronto(fase, a, b);
    let jogos;
    if (pernas === 1) {
      const casa = reaisDoConfronto[0]?.m ?? mandante;
      jogos = [jogar(fase, casa, casa === a ? b : a)];
    } else {
      const melhor = ordenarPorCampanha([a, b])[0];
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

  return { reiniciar, jogar, jogarCalendario, classificar, ordenarPorCampanha, confronto, todosContraTodos, avisos };
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
export function tabelaDoGrupo(dados, momento, grupo) {
  const ate = momento.ate;
  const ids = Object.keys(dados.times).filter((id) => dados.times[id].grupo === grupo);
  const linhas = new Map(ids.map((id) => [id, { id, pontos: 0, jogos: 0, vitorias: 0, saldo: 0, golsPro: 0 }]));
  for (const j of dados.jogos) {
    if (j.fase !== "primeira-fase" || !j.disputado || ate === null || j.data > ate) continue;
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
  return [...linhas.values()]
    .sort((a, b) => (b.pontos - a.pontos) || (b.vitorias - a.vitorias) || (b.saldo - a.saldo)
      || (b.golsPro - a.golsPro) || a.id.localeCompare(b.id))
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}
