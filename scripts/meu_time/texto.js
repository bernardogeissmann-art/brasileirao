// texto.js
// Escreve o parágrafo "Situação atual" da página Meu Time, em tom de conversa.
// Não usa inteligência artificial: são frases prontas, escolhidas conforme a situação do time
// (fase, último jogo, tabela, chances, notícia da semana e próximo jogo). Para o texto não
// ficar sempre igual, cada situação tem algumas versões, e a escolha muda a cada atualização.

// Nome usado no texto (mais curto que o nome oficial, como se fala no dia a dia).
const NOME_NO_TEXTO = {
  "clube-do-remo": "Remo", "vasco-da-gama": "Vasco", paranaense: "Athletico",
  "america-mineiro": "América-MG", "atletico-goianiense": "Atlético-GO", "operario-pr": "Operário",
};
// Times que se diz "a": "a Chapecoense". Os outros são "o".
const FEMININOS = new Set(["chapecoense", "ponte-preta"]);

// Formas do artigo para cada time: "o Flamengo", "do Flamengo", "ao Flamengo"...
export function artigos(id) {
  const fem = FEMININOS.has(id);
  return {
    o: fem ? "a" : "o", O: fem ? "A" : "O", do: fem ? "da" : "do", no: fem ? "na" : "no",
    ao: fem ? "à" : "ao", pelo: fem ? "pela" : "pelo", favorito: fem ? "favorita" : "favorito",
  };
}

export function nomeNoTexto(id, nomeOficial) {
  return NOME_NO_TEXTO[id] ?? nomeOficial;
}

// Chance em texto curto: 0.814 -> "81%".
export function porcento(p) {
  if (p === 0) return "0%";
  if (p === 1) return "100%";
  if (p < 0.01) return "menos de 1%";
  if (p > 0.99) return "mais de 99%";
  return `${Math.round(p * 100)}%`;
}

// Escolhe uma das versões de uma frase. "semente" muda a cada atualização e a cada time,
// então os textos variam, mas quem rodar de novo no mesmo dia recebe o mesmo texto.
function escolher(versoes, semente) {
  return versoes[semente % versoes.length];
}

function numeroDaSemente(texto) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const plural = (n, um, varios) => (n === 1 ? `${n} ${um}` : `${n} ${varios}`);

// Monta o parágrafo.
//   info: tudo o que se sabe do time (veja atualizar_meu_time.js)
//   noticias: lista de notícias recentes (a mais nova primeiro)
//   dia: texto da data da atualização (usado para variar as frases)
export function escreverTexto(info, noticias, dia) {
  const semente = numeroDaSemente(info.id + dia);
  const a = artigos(info.id);
  const time = nomeNoTexto(info.id, info.nome);
  const frases = [];

  // 0) Reta final: se o time está numa briga, o texto começa por ela e gira em torno dela
  //    (a fase geral, a frase da tabela e a dos gols saem para dar lugar à luta).
  const briga = info.brigas?.[0] ?? null;
  if (briga) frases.push(...frasesDaBriga(briga, info, a, time));

  // 1) A fase: pontos nos últimos 5 jogos.
  const u = info.ultimos;
  if (u.length > 0 && !briga) {
    const pontos = u.reduce((s, j) => s + (j.resultado === "V" ? 3 : j.resultado === "E" ? 1 : 0), 0);
    const vitorias = u.filter((j) => j.resultado === "V").length;
    const de = u.length === 5 ? "dos últimos 15" : `dos últimos ${u.length * 3}`;
    const jogos = u.length === 5 ? "cinco jogos" : plural(u.length, "jogo", "jogos");
    let versoes;
    if (pontos >= 12) {
      versoes = [`${a.O} ${time} vive grande fase: ${plural(vitorias, "vitória", "vitórias")} nos últimos ${jogos}.`,
        `Fase de ouro para ${a.o} ${time}, que venceu ${vitorias} dos últimos ${jogos}.`,
        `${a.O} ${time} está embalado: fez ${pontos} ${de} pontos possíveis.`];
    } else if (pontos >= 9) {
      versoes = [`${a.O} ${time} atravessa uma boa fase: somou ${pontos} ${de} pontos possíveis.`,
        `O momento ${a.do} ${time} é bom, com ${pontos} pontos conquistados nos últimos ${jogos}.`];
    } else if (pontos >= 6) {
      versoes = [`${a.O} ${time} vive uma fase de altos e baixos: ${pontos} pontos nos últimos ${jogos}.`,
        `Nem lá, nem cá: ${a.o} ${time} fez ${pontos} ${de} pontos possíveis.`];
    } else if (pontos >= 3) {
      versoes = [`A fase não é das melhores para ${a.o} ${time}: só ${pontos} pontos nos últimos ${jogos}.`,
        `${a.O} ${time} anda devendo, com apenas ${pontos} ${de} pontos possíveis.`];
    } else {
      versoes = [`Momento difícil para ${a.o} ${time}: ${plural(pontos, "ponto", "pontos")} nos últimos ${jogos}.`,
        `A fase é ruim para ${a.o} ${time}, que fez só ${plural(pontos, "ponto", "pontos")} ${de} possíveis.`];
    }
    frases.push(escolher(versoes, semente));

    // 2) O último jogo e a sequência.
    const ultimo = u[0];
    const adv = artigos(ultimo.adversario);
    const nomeAdv = nomeNoTexto(ultimo.adversario, ultimo.nomeAdversario);
    const local = ultimo.emCasa ? " em casa" : " fora de casa";
    let frase;
    if (ultimo.resultado === "V") frase = `No último jogo, venceu ${adv.o} ${nomeAdv} por ${ultimo.golsPro} a ${ultimo.golsContra}${local}.`;
    else if (ultimo.resultado === "E") frase = `No último jogo, ficou no ${ultimo.golsPro} a ${ultimo.golsContra} com ${adv.o} ${nomeAdv}${local}.`;
    else frase = `No último jogo, perdeu para ${adv.o} ${nomeAdv} por ${ultimo.golsContra} a ${ultimo.golsPro}${local}.`;
    const s = info.sequencia;
    // (Se a primeira frase já disse "5 vitórias nos últimos 5", só repete se a série for maior.)
    if (s.vitorias >= 3 && (s.vitorias > u.length || vitorias < u.length)) frase += ` São ${s.vitorias} vitórias seguidas.`;
    else if (s.invicto >= 3) frase += ` Já são ${s.invicto} jogos sem perder.`;
    else if (s.derrotas >= 3) frase += ` São ${s.derrotas} derrotas seguidas.`;
    else if (s.semVencer >= 3) frase += ` Já são ${s.semVencer} jogos sem vencer.`;
    frases.push(frase);
  }

  // 3) A tabela e as chances.
  const c = info.chances;
  const onde = `${info.posicao}º lugar, com ${info.pontos} pontos`;
  const serieB = info.campeonato === "serie-b";
  // Série B: a briga é pelo acesso (1º e 2º sobem direto; do 3º ao 6º, playoff).
  // Primeiro, o que já está decidido (100% em todas as simulações).
  if (briga) {
    // (já dito nas frases da briga)
  } else if (serieB) {
    frases.push(fraseSerieB(c, onde, a, time));
  } else if (c.titulo === 1) {
    frases.push(`Em ${onde}, ${a.o} ${time} já tem o título garantido. É campeão!`);
  } else if (c.rebaixamento === 1) {
    frases.push(`Em ${onde}, o rebaixamento já está confirmado, infelizmente.`);
  } else if (c.libertadores === 1 && c.titulo < 0.05) {
    frases.push(`Em ${onde}, ${a.o} ${time} já garantiu a vaga na Libertadores.`);
  } else if (c.titulo >= 0.25) {
    frases.push(`Na tabela, ${a.o} ${time} está em ${onde}, e o título está bem vivo: ${porcento(c.titulo)} de chance pelas nossas simulações.`);
  } else if (c.titulo >= 0.05) {
    const libertadores = c.libertadores === 1 ? "já garantiu a vaga na Libertadores"
      : `tem ${porcento(c.libertadores)} de chance de ir para a Libertadores`;
    frases.push(`Em ${onde}, ${a.o} ${time} ainda sonha com o título (${porcento(c.titulo)} de chance) e ${libertadores}.`);
  } else if (c.libertadores >= 0.6) {
    frases.push(`Em ${onde}, a vaga na Libertadores está bem encaminhada: ${porcento(c.libertadores)} de chance.`);
  } else if (c.libertadores >= 0.15) {
    frases.push(`Em ${onde}, a briga pela Libertadores está aberta: ${porcento(c.libertadores)} de chance pelas nossas contas.`);
  } else if (c.rebaixamento >= 0.5) {
    frases.push(`A situação é delicada: ${onde} e ${porcento(c.rebaixamento)} de risco de rebaixamento.`);
  } else if (c.rebaixamento >= 0.15) {
    frases.push(`Em ${onde}, o sinal de alerta está ligado: ${porcento(c.rebaixamento)} de risco de cair.`);
  } else if (c.sulamericana >= 0.4) {
    frases.push(`Em ${onde}, a vaga na Sul-Americana é o objetivo mais realista: ${porcento(c.sulamericana)} de chance.`);
  } else {
    frases.push(`Em ${onde}, ${a.o} ${time} está numa zona tranquila da tabela, longe das brigas de cima e de baixo.`);
  }

  // 4) Destaques positivos e negativos (ataque e defesa nos últimos jogos).
  if (u.length >= 3 && !briga) {
    const gp = u.reduce((s, j) => s + j.golsPro, 0);
    const gc = u.reduce((s, j) => s + j.golsContra, 0);
    const n = u.length;
    const ataque = gp >= 2 * n ? ["bom", `o ataque está afiado, com ${gp} gols em ${n} jogos`]
      : gp <= Math.floor(0.6 * n) ? ["ruim", `o ataque anda travado, com só ${plural(gp, "gol", "gols")} em ${n} jogos`] : null;
    const defesa = gc <= Math.floor(0.6 * n) ? ["bom", `a defesa vem segura, com só ${plural(gc, "gol sofrido", "gols sofridos")}`]
      : gc >= 2 * n ? ["ruim", `a defesa preocupa, com ${gc} gols sofridos`] : null;
    const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    if (ataque && defesa) {
      const liga = ataque[0] === defesa[0] ? ", e " : ", mas ";
      frases.push(`${maiuscula(ataque[1])}${liga}${defesa[1]}.`);
    } else if (ataque || defesa) {
      frases.push(`${maiuscula((ataque ?? defesa)[1])}.`);
    } else {
      frases.push(`Nos últimos ${n} jogos, foram ${plural(gp, "gol marcado", "gols marcados")} e ${plural(gc, "sofrido", "sofridos")}: tudo bem equilibrado.`);
    }
  }

  // 5) A notícia da semana.
  if (noticias.length > 0) {
    // Time numa briga: de preferência, uma manchete sobre a briga.
    const sobreABriga = /rebaix|z-?4|zona|acesso|t[ií]tulo|secar|luta|briga|queda|playoff|degola/i;
    // E, se der, nunca uma de serviço ("onde assistir", "escalações").
    const deServico = /onde assistir|escala[çc][õo]es|hor[áa]rio|palpite/i;
    const n = (briga && noticias.find((x) => sobreABriga.test(x.titulo)))
      || noticias.find((x) => !deServico.test(x.titulo)) || noticias[0];
    const segundo = n.veiculo === "ESPN" ? "segundo a ESPN" : `segundo o ${n.veiculo}`;
    frases.push(escolher([
      `Fora de campo, o assunto da semana é: “${n.titulo}” (${n.veiculo}).`,
      `Nos bastidores, a notícia que mais chama atenção é “${n.titulo}”, ${segundo}.`,
    ], semente));
  }

  // 6) O próximo jogo.
  const p = info.proximo;
  if (briga) {
    // (o próximo jogo já entra nas frases da briga, com o que muda em cada resultado)
  } else if (p) {
    const adv = artigos(p.adversario);
    const nomeAdv = nomeNoTexto(p.adversario, p.nomeAdversario);
    const inicio = `Agora o desafio é ${adv.o} ${nomeAdv}, ${p.emCasa ? "em casa" : "fora de casa"}, ${p.dia}`;
    if (p.vitoria >= 0.55) frases.push(`${inicio}, e ${a.o} ${time} chega como ${a.favorito}: ${porcento(p.vitoria)} de chance de vitória.`);
    else if (p.vitoria >= 0.4) frases.push(`${inicio}, num jogo equilibrado: ${porcento(p.vitoria)} de chance de vitória pelo modelo.`);
    else if (p.vitoria > 0.25) frases.push(`${inicio}. Jogo difícil: o modelo dá ${porcento(p.vitoria)} de chance de vitória.`);
    else frases.push(`${inicio}. Pedreira: o modelo dá só ${porcento(p.vitoria)} de chance de vitória.`);
  } else {
    frases.push(`A temporada ${a.do} ${time} ${serieB ? "na Série B" : "no Brasileirão"} já terminou.`);
  }
  if (briga) {
    const fecho = fraseDoProximoNaBriga(briga, info);
    if (fecho) frases.push(fecho);
  }

  return frases.join(" ");
}

// As frases de um time numa briga da reta final (título, acesso ou rebaixamento), com os
// números de site/js/briga.js: a luta e a distância, os rivais e o que muda no próximo jogo.
// Devolve { abertura, rivais, proximo }; "proximo" vai no fim do texto.
function frasesDaBriga(briga, info, a, time) {
  const nome = (id) => `${artigos(id).o} ${nomeNoTexto(id, briga.nomes?.[id] ?? id)}`;
  const pontos = (n) => plural(n, "ponto", "pontos");
  const faltam = briga.faltam === 1 ? "Na última rodada" : `A ${briga.faltam} jogos do fim`;
  const luta = { titulo: "na briga pelo título", acesso: "na briga pelo acesso", rebaixamento: "na luta contra o rebaixamento" }[briga.tipo];
  const frases = [];

  // 1) A luta, a posição e a distância para a linha que importa.
  let distancia = "";
  const d = briga.distancia;
  if (d) {
    const quem = `${nome(d.id)}, ${d.posicao}º`;
    const linha = {
      titulo: d.dentro ? "" : "",
      acesso: d.dentro ? ", o primeiro fora da zona do playoff" : ", o último dentro da zona do playoff",
      rebaixamento: d.dentro ? ", o primeiro da zona de rebaixamento" : ", o primeiro fora da zona",
    }[briga.tipo];
    distancia = d.pontos === 0 ? `, empatado em pontos com ${quem}${linha}`
      : d.dentro ? `, ${d.pontos === 1 ? "só 1 ponto" : pontos(d.pontos)} à frente d${quem}${linha}`
        : `, ${pontos(d.pontos)} atrás d${quem}${linha}`;
  }
  frases.push(`${faltam}, ${a.o} ${time} está ${luta}: ${info.posicao}º lugar, com ${info.pontos} pontos${distancia}.`);
  const chance = { titulo: "a chance de título é de", acesso: "a chance de acesso é de", rebaixamento: "o risco de cair é de" }[briga.tipo];
  frases.push(`Pelas nossas simulações, ${chance} ${porcento(briga.chance)}.`);

  // 2) Os rivais diretos (os três mais envolvidos).
  const rivais = briga.rivais.slice(0, 3).map((r) => `${nome(r.id)} (${porcento(r.chance)})`);
  if (rivais.length === 1) frases.push(`A disputa é direta com ${rivais[0]}.`);
  else if (rivais.length > 1) {
    frases.push(`A briga é embolada: ${rivais.slice(0, -1).join(", ")} e ${rivais.at(-1)} também estão nela.`);
  }

  // 3) O último jogo (curto).
  const ultimo = info.ultimos[0];
  if (ultimo) {
    const adv = nome(ultimo.adversario === undefined ? "" : ultimo.adversario);
    const placar = ultimo.resultado === "D" ? `${ultimo.golsContra} a ${ultimo.golsPro}` : `${ultimo.golsPro} a ${ultimo.golsContra}`;
    const verbo = { V: `venceu ${adv} por ${placar}`, E: `empatou em ${placar} com ${adv}`, D: `perdeu para ${adv} por ${placar}` }[ultimo.resultado];
    frases.push(`No último jogo, ${verbo}${ultimo.emCasa ? " em casa" : " fora de casa"}.`);
  }
  return frases;
}

// O que muda no próximo jogo de um time numa briga (vai no fim do texto).
function fraseDoProximoNaBriga(briga, info) {
  const p = briga.proximo;
  if (!p || p.vitoria === null || p.empate === null || p.derrota === null) return null;
  const adv = `${artigos(p.adversario).o} ${nomeNoTexto(p.adversario, briga.nomes?.[p.adversario] ?? p.adversario)}`;
  const dia = info.proximo ? `, ${info.proximo.dia}` : "";
  const oQue = { titulo: "a chance de título", acesso: "a chance de acesso", rebaixamento: "o risco de cair" }[briga.tipo];
  // 100% e 0% viram palavras ("cai", "está salvo"), como pede o resto do site.
  const certo = { titulo: "é campeão", acesso: "garante o acesso", rebaixamento: "cai" }[briga.tipo];
  const impossivel = { titulo: "perde a chance de título", acesso: "fica sem o acesso", rebaixamento: "está salvo" }[briga.tipo];
  // O primeiro número leva a frase inteira ("o risco de cair vai a 11%"); os seguintes, só "a 34%".
  let jaDisse = false;
  const efeito = (v) => {
    if (v === 1) return `${artigos(info.id).o} ${nomeNoTexto(info.id, info.nome)} ${certo}`;
    if (v === 0) return `${artigos(info.id).o} ${nomeNoTexto(info.id, info.nome)} ${impossivel}`;
    const texto = jaDisse ? `a ${porcento(v)}` : `${oQue} vai a ${porcento(v)}`;
    jaDisse = true;
    return texto;
  };
  // Junta os resultados que dão no mesmo ("com empate ou derrota, cai").
  const casos = [["vitória", p.vitoria], ["empate", p.empate], ["derrota", p.derrota]];
  const partes = [];
  for (const [nome, valor] of casos) {
    const texto = efeito(valor);
    const anterior = partes.at(-1);
    if (anterior && anterior.texto === texto) anterior.nomes.push(nome);
    else partes.push({ nomes: [nome], texto });
  }
  const clausulas = partes.map((x) => `com ${x.nomes.join(" ou ")}, ${x.texto}`).join("; ");
  return `Agora vem ${adv}, ${p.emCasa ? "em casa" : "fora de casa"}${dia}, e o jogo pesa: ${clausulas}.`;
}

// A frase da tabela e das chances na Série B.
function fraseSerieB(c, onde, a, time) {
  if (c.titulo === 1) return `Em ${onde}, ${a.o} ${time} já é campeão da Série B e está de volta à Série A!`;
  if (c.rebaixamento === 1) return `Em ${onde}, a queda para a Série C já está confirmada, infelizmente.`;
  if (c.acesso_direto === 1) return `Em ${onde}, ${a.o} ${time} já garantiu o acesso à Série A.`;
  if (c.acesso === 0 && c.rebaixamento === 0) {
    return `Em ${onde}, ${a.o} ${time} já não briga pelo acesso nem corre risco de cair: a temporada é de transição.`;
  }
  if (c.acesso >= 0.6) return `Em ${onde}, o acesso está bem encaminhado: ${porcento(c.acesso)} de chance pelas nossas simulações.`;
  if (c.acesso >= 0.15) {
    const playoff = c.playoff >= 0.3 ? `, quase sempre passando pelo playoff (${porcento(c.playoff)} de chance de ficar entre o 3º e o 6º)` : "";
    return `Em ${onde}, a briga pelo acesso está aberta: ${porcento(c.acesso)} de chance pelas nossas contas${playoff}.`;
  }
  if (c.rebaixamento >= 0.5) return `A situação é delicada: ${onde} e ${porcento(c.rebaixamento)} de risco de cair para a Série C.`;
  if (c.rebaixamento >= 0.15) return `Em ${onde}, o sinal de alerta está ligado: ${porcento(c.rebaixamento)} de risco de cair.`;
  if (c.playoff >= 0.15) return `Em ${onde}, a meta realista é o playoff: ${porcento(c.playoff)} de chance de terminar entre o 3º e o 6º.`;
  return `Em ${onde}, ${a.o} ${time} está numa zona tranquila da tabela, longe das brigas de cima e de baixo.`;
}
