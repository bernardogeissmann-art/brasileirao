// briga.js
// Decide se um time está numa "briga" da reta final (título, acesso ou rebaixamento) e junta
// os números dessa briga: a chance, os rivais, a distância para a linha que importa e quanto a
// chance muda com vitória, empate ou derrota no próximo jogo.
// Só contas, sem HTML: serve para a página Meu Time (site/js/meu-time.js) e para o texto
// "Situação atual" escrito pela IA (scripts/meu_time/).

// Com quantos jogos (ou menos) por fazer um time entra em "modo reta final".
export const JOGOS_DA_RETA_FINAL = 5;

// Um time está na briga se a chance estiver entre 5% e 95% (fora disso, já está praticamente decidido).
const LIMITE = 0.05;
// Rivais: os outros times com pelo menos 1% (e no máximo 99%) na mesma briga.
const LIMITE_RIVAL = 0.01;

// As brigas possíveis em cada campeonato.
//   linha: a última posição "boa" (o líder no título; o 6º no acesso da Série B; o 16º no rebaixamento).
//   campo: a chance que o simular() devolve; ruim: true quando o time quer FUGIR daquilo.
function tiposDeBriga(campeonato, faixas) {
  const tipos = [{ tipo: "titulo", campo: "titulo", titulo: "Briga pelo título", linha: faixas.titulo[1] }];
  if (campeonato === "serie-b") {
    tipos.push({ tipo: "acesso", campo: "acesso", titulo: "Briga pelo acesso", linha: faixas.playoff[1] });
  }
  tipos.push({ tipo: "rebaixamento", campo: "rebaixamento", titulo: "Luta contra o rebaixamento",
    linha: faixas.rebaixamento[0] - 1, ruim: true });
  return tipos;
}

// Quantos jogos o time ainda tem por fazer (conta os adiados, que não seguem a ordem das rodadas).
export function jogosQueFaltam(jogos, id) {
  return jogos.filter((j) => !j.disputado && (j.mandante === id || j.visitante === id)).length;
}

// A chance de uma briga dentro de um resultado do próximo jogo (vitória, empate ou derrota).
function chanceNoResultado(r, tipo, faixas) {
  if (!r || r.vezes === 0) return null;   // esse resultado não saiu em nenhuma simulação
  if (tipo === "acesso") return r.acesso;
  const [de, ate] = tipo === "titulo" ? faixas.titulo : faixas.rebaixamento;
  return r.posicoes.slice(de - 1, ate).reduce((soma, p) => soma + p, 0);
}

// As brigas de um time. Devolve uma lista (vazia se o time não briga por nada agora).
//   id: o time; campeonato: "serie-a" ou "serie-b"; faixas: as faixas da ficha do campeonato
//   resultado: o que simular() devolveu (com opcoes.condicionais, para ter o proximoJogo)
//   tabela: a tabela atual (tabelaAtual); jogos: a lista de jogos do campeonato
export function brigasDoTime({ id, campeonato, faixas, resultado, tabela, jogos }) {
  const faltam = jogosQueFaltam(jogos, id);
  if (faltam === 0 || faltam > JOGOS_DA_RETA_FINAL) return [];
  const chances = new Map(resultado.times.map((t) => [t.id, t]));
  const eu = chances.get(id);
  const minhaLinha = tabela.find((l) => l.id === id);

  return tiposDeBriga(campeonato, faixas)
    .filter(({ campo }) => eu[campo] >= LIMITE && eu[campo] <= 1 - LIMITE)
    .map(({ tipo, campo, titulo, linha, ruim }) => {
      // Os rivais, do mais ameaçador para o menos (no rebaixamento, quem tem mais risco vem primeiro).
      const rivais = resultado.times
        .filter((t) => t.id !== id && t[campo] >= LIMITE_RIVAL && t[campo] <= 1 - LIMITE_RIVAL)
        .sort((a, b) => b[campo] - a[campo])
        .slice(0, 6)
        .map((t) => {
          const l = tabela.find((x) => x.id === t.id);
          return { id: t.id, chance: t[campo], posicao: l.posicao, pontos: l.pontos,
            proximo: t.proximoJogo ? { adversario: t.proximoJogo.adversario, emCasa: t.proximoJogo.emCasa } : null };
        });

      // A distância para a linha: quem está do lado bom olha para o primeiro do lado ruim, e vice-versa.
      const dentro = minhaLinha.posicao <= linha;
      const referencia = tabela[dentro ? linha : linha - 1];   // tabela[0] é o 1º
      const distancia = referencia
        ? { dentro, pontos: Math.abs(minhaLinha.pontos - referencia.pontos), id: referencia.id, posicao: referencia.posicao }
        : null;

      const p = eu.proximoJogo;
      const proximo = p ? {
        id: p.id, data: p.data, adversario: p.adversario, emCasa: p.emCasa,
        vitoria: chanceNoResultado(p.vitoria, tipo, faixas),
        empate: chanceNoResultado(p.empate, tipo, faixas),
        derrota: chanceNoResultado(p.derrota, tipo, faixas),
      } : null;

      return { tipo, titulo, ruim: Boolean(ruim), chance: eu[campo], linha, faltam, rivais, distancia, proximo };
    });
}
