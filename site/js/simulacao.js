// simulacao.js
// Simula o resto do Brasileirão milhares de vezes (método de Monte Carlo) e calcula,
// para cada time, a chance de terminar em cada posição e a de cada "faixa" da tabela:
// na Série A, título, Libertadores, Sul-Americana e rebaixamento; na Série B, título,
// acesso (com o playoff do 3º ao 6º) e rebaixamento.
//
// O motor é o mesmo para os dois campeonatos. O que muda de um para o outro (faixas,
// playoff) vem da "ficha" do campeonato: data/<campeonato>/configuracao.json.
//
// É um "módulo": um arquivo cujas funções outros arquivos podem usar com "import".
// A palavra "export" na frente de uma função é o que deixa ela disponível lá fora.
//
// Regras de desempate e vagas: Regulamento Específico da Competição (REC) de cada
// campeonato. Série A 2026: CBF, 16/12/2025 (Arts. 6º, 7º, 8º e 15). Série B 2026:
// Arts. 5º, 12 e 13. Os critérios de desempate da tabela são os mesmos nas duas.

// ---------------------------------------------------------------------------
// CONSTANTES
// "const" cria um nome para um valor que não vai ser trocado depois.
// ---------------------------------------------------------------------------

export const N_SIMULACOES_PADRAO = 10_000;   // o "_" só separa os milhares

// Faixas da Série A (de, até), previstas nos Arts. 6º a 8º do REC 2026. São as mesmas da
// ficha data/serie-a/configuracao.json (um teste confere) e valem quando a simulação
// recebe dados sem ficha.
// As vagas podem "descer" (ex.: G5, G6) se o campeão ou o vice da Copa do Brasil,
// ou um campeão continental, já estiver classificado pelo Brasileirão.
// O modelo não sabe disso, então usamos a faixa básica do regulamento.
export const FAIXAS = {
  titulo: [1, 1],
  g4: [1, 4],              // Libertadores direto na fase de grupos
  libertadores: [1, 5],    // inclui o 5º, que vai para a fase preliminar
  sulamericana: [6, 11],   // os 6 seguintes aos classificados à Libertadores
  rebaixamento: [17, 20],  // os 4 últimos caem para a Série B
};

// Critérios de desempate que este motor sabe aplicar, na ordem (Série A: Art. 15;
// Série B: Art. 12). Se a ficha de um campeonato pedir outra ordem, a simulação avisa.
const DESEMPATE = ["vitorias", "saldo_de_gols", "gols_pro", "confronto_direto",
  "cartoes_vermelhos", "cartoes_amarelos", "sorteio"];

// Maior placar considerado para um lado. A chance de 16 gols ou mais é praticamente zero.
const MAX_GOLS = 15;


// ---------------------------------------------------------------------------
// CARREGAR OS DADOS (só funciona no navegador, com o site aberto por um servidor)
// ---------------------------------------------------------------------------

// "async" indica uma função que espera coisas demoradas (como baixar arquivos).
// "await" é o ponto onde ela espera. Quem chama usa: const dados = await carregarDados();
//   campeonato: o nome da pasta dos dados ("serie-a", o padrão, ou "serie-b").
export async function carregarDados(campeonato = "serie-a") {
  // import.meta.url é o endereço deste arquivo (site/js/simulacao.js).
  // A partir dele, "../../data/serie-a/" aponta para a pasta dos dados da Série A.
  const pasta = new URL(`../../data/${campeonato}/`, import.meta.url);
  // Promise.all baixa os três arquivos ao mesmo tempo, e espera todos terminarem.
  const [jogos, modelo, config] = await Promise.all([
    baixarJson(new URL("jogos.json", pasta)),
    baixarJson(new URL("modelo.json", pasta)),
    baixarJson(new URL("configuracao.json", pasta)),
  ]);
  return { jogos, modelo, config };
}

async function baixarJson(endereco) {
  const resposta = await fetch(endereco);   // fetch = "vá buscar este endereço"
  if (!resposta.ok) {                        // "!" quer dizer "não"
    throw new Error(`Não consegui ler ${endereco} (erro ${resposta.status})`);
  }
  return resposta.json();                    // converte o texto JSON em objetos
}


// ---------------------------------------------------------------------------
// SORTEIO
// ---------------------------------------------------------------------------

// Cria um "sorteador": uma função que, a cada chamada, devolve um número entre 0 e 1.
// Com a mesma "semente", a sequência é sempre a mesma. Isso é útil nos testes,
// para os resultados serem repetíveis. A receita (chamada mulberry32) é conhecida
// e rápida; não é preciso entender as contas de dentro.
export function criarSorteador(semente) {
  let estado = semente >>> 0;   // "let" é como "const", mas permite trocar o valor
  return function () {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Prepara a "roleta" de gols de um lado do jogo: a chance ACUMULADA de sair
// até 0 gol, até 1 gol, até 2 gols... pela distribuição de Poisson.
// Ex.: média 1,5 -> [0.22, 0.56, 0.81, 0.93, 0.98, ...]
export function chancesAcumuladas(media) {
  const acumuladas = [];                 // [] é uma lista vazia
  let chance = Math.exp(-media);         // chance de 0 gol: e^(-média)
  let soma = 0;
  for (let gols = 0; gols <= MAX_GOLS; gols++) {   // repete para 0, 1, 2, ..., 15
    soma += chance;
    acumuladas.push(soma);               // push = coloca no fim da lista
    // Truque da Poisson: a chance de (gols + 1) é a chance de "gols" × média / (gols + 1).
    chance = chance * media / (gols + 1);
  }
  return acumuladas;
}

// Sorteia quantos gols um lado faz. Sorteamos um número entre 0 e 1 e andamos
// pela roleta até passar dele. Ex.: com [0.22, 0.56, 0.81...], o número 0.70
// cai depois de 0.56 e antes de 0.81, então saem 2 gols.
export function sortearGols(acumuladas, sortear) {
  const numero = sortear();
  let gols = 0;
  // "&&" quer dizer "e". Para quando acabar a lista ou quando achar a faixa do número.
  while (gols < acumuladas.length && numero >= acumuladas[gols]) {
    gols++;
  }
  return gols;
}

// Média de gols esperada de cada lado, pelo modelo do estimar_modelo.py.
export function golsEsperados(jogo, modelo) {
  const mandante = modelo.times[jogo.mandante];
  const visitante = modelo.times[jogo.visitante];
  // Jogo em campo neutro (ex.: a final da Sul-Americana): ninguém tem a vantagem de casa.
  const h = jogo.neutro ? 1 : modelo.fator_casa;
  return [
    mandante.ataque * visitante.defesa * h,                   // α_m · β_v · h
    visitante.ataque * mandante.defesa,                       // α_v · β_m
  ];
}

// Chance de cada número de gols (0, 1, 2, ..., 15) para uma média, pela Poisson.
export function distribuicaoGols(media) {
  const chances = [];
  let chance = Math.exp(-media);          // chance de 0 gol
  for (let gols = 0; gols <= MAX_GOLS; gols++) {
    chances.push(chance);
    chance = chance * media / (gols + 1);
  }
  return chances;
}

// As chances de um jogo isolado, sem simular: vitória de cada lado, empate
// e o placar mais provável. Usado na página "O Método".
export function chancesDoJogo(jogo, modelo) {
  const [mediaM, mediaV] = golsEsperados(jogo, modelo);
  const golsM = distribuicaoGols(mediaM);
  const golsV = distribuicaoGols(mediaV);
  let vitoriaM = 0;
  let empate = 0;
  let vitoriaV = 0;
  let placarMaisProvavel = { gols_mandante: 0, gols_visitante: 0, chance: 0 };

  // Passa por todos os placares possíveis (0x0, 0x1, ..., 15x15).
  // Como os gols de um lado não dependem dos do outro, a chance de um placar é
  // a chance do mandante fazer "m" gols vezes a chance do visitante fazer "v".
  for (let m = 0; m <= MAX_GOLS; m++) {
    for (let v = 0; v <= MAX_GOLS; v++) {
      const chance = golsM[m] * golsV[v];
      if (m > v) vitoriaM += chance;
      else if (m === v) empate += chance;
      else vitoriaV += chance;
      if (chance > placarMaisProvavel.chance) {
        placarMaisProvavel = { gols_mandante: m, gols_visitante: v, chance };
      }
    }
  }
  return { mediaM, mediaV, golsM, golsV, vitoriaM, empate, vitoriaV, placarMaisProvavel };
}


// ---------------------------------------------------------------------------
// ESTATÍSTICAS DOS TIMES
// Cada time é identificado por um número (0 a 19), a sua posição na lista de times.
// Int32Array é uma lista só de números inteiros; é bem mais rápida que uma lista comum,
// o que importa quando repetimos tudo 10.000 vezes.
// ---------------------------------------------------------------------------

export function criarEstatisticas(nTimes) {
  return {
    nTimes,
    jogos: new Int32Array(nTimes),
    pontos: new Int32Array(nTimes),
    vitorias: new Int32Array(nTimes),
    golsPro: new Int32Array(nTimes),
    golsContra: new Int32Array(nTimes),
    // Para o confronto direto: a posição [a * nTimes + b] guarda o que o time "a"
    // conseguiu contra o time "b" (pontos e saldo, somando ida e volta).
    pontosConfronto: new Int32Array(nTimes * nTimes),
    saldoConfronto: new Int32Array(nTimes * nTimes),
  };
}

// Copia todos os números de "origem" para "destino" (.set copia uma lista inteira).
function copiarEstatisticas(origem, destino) {
  destino.jogos.set(origem.jogos);
  destino.pontos.set(origem.pontos);
  destino.vitorias.set(origem.vitorias);
  destino.golsPro.set(origem.golsPro);
  destino.golsContra.set(origem.golsContra);
  destino.pontosConfronto.set(origem.pontosConfronto);
  destino.saldoConfronto.set(origem.saldoConfronto);
}

// Soma o resultado de um jogo nas estatísticas dos dois times.
export function registrarResultado(est, mandante, visitante, golsMandante, golsVisitante) {
  est.jogos[mandante]++;
  est.jogos[visitante]++;
  est.golsPro[mandante] += golsMandante;
  est.golsContra[mandante] += golsVisitante;
  est.golsPro[visitante] += golsVisitante;
  est.golsContra[visitante] += golsMandante;

  // Pontos de cada um: 3 por vitória, 1 por empate, 0 por derrota.
  // "condição ? A : B" quer dizer "se a condição for verdadeira, A; senão, B".
  const pontosMandante = golsMandante > golsVisitante ? 3 : golsMandante === golsVisitante ? 1 : 0;
  const pontosVisitante = golsVisitante > golsMandante ? 3 : golsMandante === golsVisitante ? 1 : 0;
  est.pontos[mandante] += pontosMandante;
  est.pontos[visitante] += pontosVisitante;
  if (pontosMandante === 3) est.vitorias[mandante]++;
  if (pontosVisitante === 3) est.vitorias[visitante]++;

  const n = est.nTimes;
  est.pontosConfronto[mandante * n + visitante] += pontosMandante;
  est.pontosConfronto[visitante * n + mandante] += pontosVisitante;
  est.saldoConfronto[mandante * n + visitante] += golsMandante - golsVisitante;
  est.saldoConfronto[visitante * n + mandante] += golsVisitante - golsMandante;
}


// ---------------------------------------------------------------------------
// TABELA E DESEMPATE (Art. 15 do REC 2026)
// ---------------------------------------------------------------------------

// Compara dois times pelos pontos e pelos 3 primeiros critérios do Art. 15:
// 1º vitórias, 2º saldo de gols, 3º gols pró.
// Devolve um número negativo se "a" fica na frente, positivo se "b" fica, e 0 se empatam em tudo.
// O "||" pega o primeiro valor diferente de zero: se os pontos empatam (dá 0),
// passa para as vitórias, e assim por diante.
function compararCriterios(est, a, b) {
  const saldoA = est.golsPro[a] - est.golsContra[a];
  const saldoB = est.golsPro[b] - est.golsContra[b];
  return (
    (est.pontos[b] - est.pontos[a]) ||
    (est.vitorias[b] - est.vitorias[a]) ||
    (saldoB - saldoA) ||
    (est.golsPro[b] - est.golsPro[a])
  );
}

// Ordena um grupo de times que empataram em pontos, vitórias, saldo e gols pró.
//  - 4º critério, confronto direto: só vale se o empate for entre exatamente 2 times
//    (Art. 15, § 2º). Conta os pontos nos dois jogos entre eles e, se empatar,
//    o saldo de gols desses dois jogos (§ 1º).
//  - 5º e 6º critérios, cartões vermelhos e amarelos: não temos esses dados (e um jogo
//    sorteado não tem cartões), então eles são trocados pelo 7º critério, o sorteio.
export function desempatar(grupo, est, sortear) {
  if (grupo.length === 2) {
    const [a, b] = grupo;   // pega os dois times da lista de uma vez
    const n = est.nTimes;
    const diferenca =
      (est.pontosConfronto[b * n + a] - est.pontosConfronto[a * n + b]) ||
      (est.saldoConfronto[b * n + a] - est.saldoConfronto[a * n + b]);
    if (diferenca !== 0) {   // "!==" quer dizer "diferente de"
      return diferenca < 0 ? [a, b] : [b, a];
    }
  }
  return embaralhar([...grupo], sortear);   // [...grupo] faz uma cópia da lista
}

// Sorteio: embaralha a lista como se embaralha um baralho (método de Fisher-Yates).
function embaralhar(lista, sortear) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));   // posição sorteada entre 0 e i
    [lista[i], lista[j]] = [lista[j], lista[i]]; // troca os dois de lugar
  }
  return lista;
}

// Monta a tabela final: devolve a lista dos times do 1º ao 20º colocado.
export function montarTabela(est, sortear) {
  // Lista [0, 1, 2, ..., 19] ordenada pelos pontos e pelos critérios 1º a 3º.
  const ordem = Array.from({ length: est.nTimes }, (_, i) => i);
  ordem.sort((a, b) => compararCriterios(est, a, b));

  // Procura grupos de times empatados em tudo e resolve cada grupo com desempatar().
  const tabela = [];
  let inicio = 0;
  while (inicio < ordem.length) {
    let fim = inicio + 1;
    while (fim < ordem.length && compararCriterios(est, ordem[inicio], ordem[fim]) === 0) {
      fim++;
    }
    const grupo = ordem.slice(inicio, fim);   // os times da posição "inicio" até antes de "fim"
    tabela.push(...(grupo.length === 1 ? grupo : desempatar(grupo, est, sortear)));
    inicio = fim;
  }
  return tabela;
}


// A tabela de hoje: jogos já disputados + jogos fixados (os palpites do simulador),
// ordenada pelos mesmos critérios. Devolve uma lista do 1º ao 20º.
// O sorteador tem semente fixa para que um empate total não fique trocando de ordem
// a cada vez que a tabela é redesenhada.
export function tabelaAtual(jogos, fixados = [], sortear = criarSorteador(1)) {
  const ids = Object.keys(jogos.times);
  const numeroDoTime = new Map(ids.map((id, i) => [id, i]));
  conferirFixados(fixados, new Map(jogos.jogos.map((jogo) => [jogo.id, jogo])));
  const fixadosPorId = new Map(fixados.map((f) => [f.id, f]));
  const est = criarEstatisticas(ids.length);
  for (const jogo of jogos.jogos) {
    const placar = jogo.disputado ? jogo : fixadosPorId.get(jogo.id);
    if (placar) {
      registrarResultado(est, numeroDoTime.get(jogo.mandante), numeroDoTime.get(jogo.visitante),
        placar.gols_mandante, placar.gols_visitante);
    }
  }
  return montarTabela(est, sortear).map((t, i) => ({
    id: ids[t],
    posicao: i + 1,
    pontos: est.pontos[t],
    jogos: est.jogos[t],
    vitorias: est.vitorias[t],
    golsPro: est.golsPro[t],
    golsContra: est.golsContra[t],
    saldo: est.golsPro[t] - est.golsContra[t],
  }));
}


// ---------------------------------------------------------------------------
// SIMULAÇÃO
// ---------------------------------------------------------------------------

// Confere se os jogos fixados pelo usuário fazem sentido. Avisa com um erro se não.
function conferirFixados(fixados, jogosPorId) {
  for (const fixado of fixados) {   // "for ... of" repete para cada item da lista
    const jogo = jogosPorId.get(fixado.id);
    if (!jogo) throw new Error(`Jogo fixado ${fixado.id} não existe.`);
    if (jogo.disputado) throw new Error(`Jogo ${fixado.id} já foi disputado e não pode ser fixado.`);
    for (const gols of [fixado.gols_mandante, fixado.gols_visitante]) {
      if (!Number.isInteger(gols) || gols < 0) {
        throw new Error(`Placar inválido no jogo ${fixado.id}.`);
      }
    }
  }
}

// Confere se a ficha do campeonato pede os critérios de desempate que sabemos aplicar.
function conferirDesempate(config) {
  const pedido = config?.desempate;
  if (pedido && pedido.join() !== DESEMPATE.join()) {
    throw new Error(`Critérios de desempate não suportados: ${pedido.join(", ")}`);
  }
}

// Joga um confronto do playoff (Série B, Art. 13): ida na casa do pior colocado, volta na
// casa do melhor. Passa quem fizer mais pontos nos dois jogos; depois, o saldo de gols;
// depois, a melhor posição na tabela (o "melhor"). Devolve o número do time que passou.
//   placarDe(mandante, visitante): o placar [gols do mandante, gols do visitante] do jogo,
//   real (se já aconteceu) ou sorteado.
export function jogarPlayoff(melhor, pior, placarDe) {
  const [golsPiorIda, golsMelhorIda] = placarDe(pior, melhor);
  const [golsMelhorVolta, golsPiorVolta] = placarDe(melhor, pior);
  const pontos = (feitos, sofridos) => (feitos > sofridos ? 3 : feitos === sofridos ? 1 : 0);
  const diferencaPontos =
    pontos(golsMelhorIda, golsPiorIda) + pontos(golsMelhorVolta, golsPiorVolta) -
    pontos(golsPiorIda, golsMelhorIda) - pontos(golsPiorVolta, golsMelhorVolta);
  const saldo = golsMelhorIda + golsMelhorVolta - golsPiorIda - golsPiorVolta;
  if (diferencaPontos !== 0) return diferencaPontos > 0 ? melhor : pior;
  if (saldo !== 0) return saldo > 0 ? melhor : pior;
  return melhor;
}

// A função principal.
//   dados: { jogos, modelo, config } (o conteúdo de jogos.json, modelo.json e
//          configuracao.json; sem config, valem as faixas da Série A)
//   opcoes.n: quantas simulações (padrão 10.000)
//   opcoes.fixados: lista de { id, gols_mandante, gols_visitante } definidos pelo usuário
//   opcoes.semente: número que fixa os sorteios (mesma semente = mesmos sorteios)
//   opcoes.sortear: um sorteador pronto (usado nos testes); sem semente nem sorteador,
//                   usa Math.random, o sorteio do próprio navegador
// Os parâmetros do modelo NÃO mudam com os jogos fixados: eles só deixam de ser sorteados.
export function simular(dados, opcoes = {}) {
  // "??" quer dizer "se não foi informado, use este valor".
  const nSimulacoes = opcoes.n ?? N_SIMULACOES_PADRAO;
  const fixados = opcoes.fixados ?? [];

  // Dois sorteadores separados: um só para os gols e outro só para os desempates.
  // Com a mesma semente, o cenário com palpites usa exatamente os mesmos sorteios de gols
  // do cenário sem palpites. Assim, a diferença entre os dois vem só dos palpites,
  // e não do acaso. (Se fosse um sorteador só, um desempate a mais "embaralharia" o resto.)
  const comSemente = opcoes.semente !== undefined;
  const sorteioGols = comSemente ? criarSorteador(opcoes.semente) : (opcoes.sortear ?? Math.random);
  const sorteioDesempate = comSemente ? criarSorteador(opcoes.semente + 1) : (opcoes.sortear ?? Math.random);

  const { jogos, modelo, config } = dados;
  conferirDesempate(config);
  const faixas = config?.faixas ?? FAIXAS;
  const playoff = config?.playoff ?? null;
  const ids = Object.keys(jogos.times);                    // ["bahia", "botafogo", ...]
  const numeroDoTime = new Map(ids.map((id, i) => [id, i])); // "bahia" -> 0, "botafogo" -> 1...
  const jogosPorId = new Map(jogos.jogos.map((jogo) => [jogo.id, jogo]));
  conferirFixados(fixados, jogosPorId);
  const fixadosPorId = new Map(fixados.map((f) => [f.id, f]));

  // 1) Ponto de partida, igual em todas as simulações: os jogos já disputados.
  //    Os que faltam vão para a lista "restantes", já com a roleta de gols pronta
  //    e com o placar fixado, se o usuário tiver dado um palpite.
  const base = criarEstatisticas(ids.length);
  const restantes = [];
  for (const jogo of jogos.jogos) {
    const m = numeroDoTime.get(jogo.mandante);
    const v = numeroDoTime.get(jogo.visitante);
    if (jogo.disputado) {
      registrarResultado(base, m, v, jogo.gols_mandante, jogo.gols_visitante);
    } else {
      const [mediaM, mediaV] = golsEsperados(jogo, modelo);
      restantes.push({
        m, v,
        roletaM: chancesAcumuladas(mediaM),
        roletaV: chancesAcumuladas(mediaV),
        fixado: fixadosPorId.get(jogo.id) ?? null,
      });
    }
  }

  // contagem[time][posição] = em quantas simulações o time terminou naquela posição.
  const contagem = ids.map(() => new Array(ids.length).fill(0));
  const somaPontos = new Array(ids.length).fill(0);
  const est = criarEstatisticas(ids.length);

  // Playoff (só na Série B): um terceiro sorteador, só para esses jogos. Assim os sorteios
  // da fase de pontos corridos ficam iguais aos de um campeonato sem playoff.
  const venceuPlayoff = new Array(ids.length).fill(0);
  let placarDoPlayoff = null;
  if (playoff) {
    const sorteioPlayoff = comSemente ? criarSorteador(opcoes.semente + 2) : (opcoes.sortear ?? Math.random);
    // Jogos do playoff que já aconteceram de verdade: "mandante|visitante" -> placar.
    const reais = new Map((jogos.playoff ?? []).filter((j) => j.disputado).map((j) =>
      [`${numeroDoTime.get(j.mandante)}|${numeroDoTime.get(j.visitante)}`, [j.gols_mandante, j.gols_visitante]]));
    const roletas = new Map();   // guarda as roletas de gols de cada par, para não refazer
    placarDoPlayoff = (m, v) => {
      const chave = `${m}|${v}`;
      if (!roletas.has(chave)) {
        const [mediaM, mediaV] = golsEsperados({ mandante: ids[m], visitante: ids[v] }, modelo);
        roletas.set(chave, [chancesAcumuladas(mediaM), chancesAcumuladas(mediaV)]);
      }
      const [roletaM, roletaV] = roletas.get(chave);
      // Sorteia sempre (mesmo com o placar real), para a sequência de sorteios não mudar.
      const sorteado = [sortearGols(roletaM, sorteioPlayoff), sortearGols(roletaV, sorteioPlayoff)];
      return reais.get(chave) ?? sorteado;
    };
  }

  // 2) As simulações: cada volta é um "final de campeonato" possível.
  for (let s = 0; s < nSimulacoes; s++) {
    copiarEstatisticas(base, est);                       // volta ao ponto de partida
    for (const jogo of restantes) {
      // Sorteia sempre os dois lados, mesmo num jogo fixado (e descarta o sorteio).
      // Isso mantém a sequência de sorteios dos outros jogos igual com ou sem palpites.
      const golsM = sortearGols(jogo.roletaM, sorteioGols);
      const golsV = sortearGols(jogo.roletaV, sorteioGols);
      if (jogo.fixado) {
        registrarResultado(est, jogo.m, jogo.v, jogo.fixado.gols_mandante, jogo.fixado.gols_visitante);
      } else {
        registrarResultado(est, jogo.m, jogo.v, golsM, golsV);
      }
    }
    const tabela = montarTabela(est, sorteioDesempate);  // tabela final desta simulação
    tabela.forEach((time, posicao) => { contagem[time][posicao]++; });
    for (let t = 0; t < ids.length; t++) somaPontos[t] += est.pontos[t];
    if (playoff) {
      for (const [melhor, pior] of playoff.confrontos) {   // ex.: [3, 6] = 3º x 6º
        venceuPlayoff[jogarPlayoff(tabela[melhor - 1], tabela[pior - 1], placarDoPlayoff)]++;
      }
    }
  }

  // 3) Transforma as contagens em probabilidades (de 0 a 1).
  return resumir({ ids, times: jogos.times, contagem, somaPontos, nSimulacoes, faixas, playoff, venceuPlayoff });
}

function resumir({ ids, times, contagem, somaPontos, nSimulacoes, faixas, playoff, venceuPlayoff }) {
  const resultado = ids.map((id, t) => {
    // posicoes[0] é a chance de terminar em 1º, posicoes[19] a de terminar em 20º.
    const posicoes = contagem[t].map((vezes) => vezes / nSimulacoes);
    // Soma quantas vezes o time terminou entre as posições "de" e "ate" e divide pelo total.
    // (slice conta a partir do 0, por isso o "de - 1". Somar as contagens inteiras antes
    // de dividir evita erros de arredondamento: 100% dá exatamente 1.)
    const naFaixa = ([de, ate]) =>
      contagem[t].slice(de - 1, ate).reduce((soma, vezes) => soma + vezes, 0) / nSimulacoes;
    const linha = { id, nome: times[id].nome, posicoes };
    // Uma chance para cada faixa da ficha (Série A: titulo, g4, libertadores, ...).
    for (const [nome, faixa] of Object.entries(faixas)) linha[nome] = naFaixa(faixa);
    // Série B: "acesso" = terminar em 1º ou 2º (acesso_direto) ou vencer o playoff.
    if (playoff) {
      const [de, ate] = faixas[playoff.soma_com];
      const direto = contagem[t].slice(de - 1, ate).reduce((soma, vezes) => soma + vezes, 0);
      linha[playoff.chance] = (direto + venceuPlayoff[t]) / nSimulacoes;
    }
    linha.pontosMedios = somaPontos[t] / nSimulacoes;
    return linha;
  });
  return { simulacoes: nSimulacoes, times: resultado };
}
