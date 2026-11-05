// noticias.js
// Busca notícias recentes de um time em três veículos: Globo Esporte (ge), UOL Esporte e ESPN.
//   - ge: cada time tem um "feed" (RSS) no ge, com links diretos para as matérias.
//   - UOL e ESPN: vêm da busca do Google Notícias, que mostra de qual veículo é cada notícia.
// Só entram notícias dos últimos dias que tenham o nome do time no título.
// Se uma fonte falhar, o time só fica com menos notícias; nada para por causa disso.

const CABECALHOS = { "User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)" };
const DIAS = 10;          // notícias de até 10 dias atrás
const MAXIMO = 6;         // quantas notícias guardar por time

// Endereço do feed de cada time no ge (o que vem depois de "ge.globo.com/rss/ge/").
// Bragantino e Mirassol não têm feed próprio: as notícias do ge deles vêm do Google Notícias.
const FEEDS_GE = {
  flamengo: "futebol/times/flamengo", palmeiras: "futebol/times/palmeiras", cruzeiro: "futebol/times/cruzeiro",
  fluminense: "futebol/times/fluminense", mineiro: "futebol/times/atletico-mg", "sao-paulo": "futebol/times/sao-paulo",
  botafogo: "futebol/times/botafogo", "vasco-da-gama": "futebol/times/vasco", corinthians: "futebol/times/corinthians",
  paranaense: "pr/futebol/times/athletico-pr", coritiba: "pr/futebol/times/coritiba",
  bahia: "ba/futebol/times/bahia", vitoria: "ba/futebol/times/vitoria", "clube-do-remo": "pa/futebol/times/remo",
  chapecoense: "sc/futebol/times/chapecoense", internacional: "rs/futebol/times/internacional",
  gremio: "rs/futebol/times/gremio", santos: "sp/santos-e-regiao/futebol/times/santos",
};

// O que procurar no Google Notícias e quais palavras precisam aparecer no título
// (para não pegar, por exemplo, notícias do estado da Bahia em vez do clube).
const BUSCAS = {
  flamengo: { busca: "Flamengo", palavras: ["Flamengo", "Mengão"] },
  palmeiras: { busca: "Palmeiras", palavras: ["Palmeiras", "Verdão"] },
  cruzeiro: { busca: "Cruzeiro futebol", palavras: ["Cruzeiro"] },
  fluminense: { busca: "Fluminense", palavras: ["Fluminense", "Flu "] },
  mineiro: { busca: "Atlético-MG", palavras: ["Atlético-MG", "Atlético Mineiro", "Galo"] },
  "sao-paulo": { busca: "São Paulo futebol", palavras: ["São Paulo", "Tricolor"] },
  botafogo: { busca: "Botafogo", palavras: ["Botafogo", "Fogão"] },
  "vasco-da-gama": { busca: "Vasco", palavras: ["Vasco"] },
  corinthians: { busca: "Corinthians", palavras: ["Corinthians", "Timão"] },
  paranaense: { busca: "Athletico-PR", palavras: ["Athletico", "Furacão"] },
  coritiba: { busca: "Coritiba", palavras: ["Coritiba", "Coxa"] },
  bahia: { busca: "Bahia futebol", palavras: ["Bahia"] },
  vitoria: { busca: "Vitória futebol", palavras: ["Vitória"] },
  "clube-do-remo": { busca: "Remo futebol", palavras: ["Remo"] },
  chapecoense: { busca: "Chapecoense", palavras: ["Chapecoense", "Chape"] },
  internacional: { busca: "Internacional futebol", palavras: ["Internacional", "Inter "] },
  gremio: { busca: "Grêmio", palavras: ["Grêmio"] },
  santos: { busca: "Santos futebol", palavras: ["Santos", "Peixe"] },
  bragantino: { busca: "Bragantino", palavras: ["Bragantino", "Massa Bruta"] },
  mirassol: { busca: "Mirassol", palavras: ["Mirassol"] },
};

// Veículos aceitos (pelo endereço do site) e o nome que aparece na página.
const VEICULOS = [
  { endereco: "ge.globo.com", nome: "Globo Esporte" },
  { endereco: "uol.com.br", nome: "UOL Esporte" },
  { endereco: "espn.com.br", nome: "ESPN" },
];

// Notícias de outros esportes do clube (o feed do ge mistura basquete, vôlei...) e de outros
// times do clube (feminino, categorias de base) ficam de fora: a página é sobre o time do Brasileirão.
const OUTROS_ESPORTES = ["NBB", "basquete", "Basquete", "vôlei", "Vôlei", "futsal", "Futsal", "handebol", "Superliga",
  "eSports", "e-sports", "Feminin", "feminin", "Sub-17", "sub-17", "Sub-20", "sub-20"];

const espera = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

// Tira do título o que não é título: " - Nome do veículo" (Google Notícias) e tudo a partir
// de uma data no fim (o UOL termina alguns títulos com " - 28/10/2026 - Esporte - Folha de S.Paulo").
export function limparTitulo(titulo) {
  return titulo
    .replace(/\s+-\s+(ge|UOL|UOL Esporte|ESPN|ESPN Brasil|Globo Esporte)$/i, "")
    .replace(/\s+-\s+\d{2}\/\d{2}\/\d{4}.*$/, "")
    .trim();
}

// A notícia é mesmo sobre o time (e sobre futebol)?
export function eDoTime(titulo, palavras) {
  return palavras.some((p) => titulo.includes(p)) && !OUTROS_ESPORTES.some((p) => titulo.includes(p));
}

async function baixarTexto(url) {
  const resposta = await fetch(url, { headers: CABECALHOS });
  if (!resposta.ok) throw new Error(`erro ${resposta.status} em ${url}`);
  return resposta.text();
}

// Desfaz os códigos do XML (&amp; vira &, por exemplo) e tira o "CDATA".
function limpar(texto) {
  return texto
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

// Lê os itens de um feed RSS: título, link, data e (no Google Notícias) o veículo.
function lerItens(xml) {
  const campo = (bloco, nome) => {
    const achado = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`));
    return achado ? limpar(achado[1]) : "";
  };
  return xml.split("<item>").slice(1).map((bloco) => ({
    titulo: campo(bloco, "title"),
    link: campo(bloco, "link"),
    data: new Date(campo(bloco, "pubDate")),
    origem: (bloco.match(/<source url="([^"]+)"/) ?? [])[1] ?? "",
  }));
}

function veiculoDe(endereco) {
  return VEICULOS.find((v) => endereco.includes(v.endereco))?.nome ?? null;
}

// Busca as notícias de um time. Devolve uma lista de { titulo, veiculo, link, data }.
export async function buscarNoticias(idTime) {
  const limite = Date.now() - DIAS * 24 * 60 * 60 * 1000;
  const encontradas = [];
  const { busca, palavras } = BUSCAS[idTime];

  // 1) Feed do ge (links diretos). O feed regional às vezes traz notícias de outros
  //    times do estado, por isso também exigimos o nome do time no título.
  if (FEEDS_GE[idTime]) {
    try {
      const xml = await baixarTexto(`https://ge.globo.com/rss/ge/${FEEDS_GE[idTime]}/`);
      for (const item of lerItens(xml)) {
        const titulo = limparTitulo(item.titulo);
        if (eDoTime(titulo, palavras)) encontradas.push({ ...item, titulo, veiculo: "Globo Esporte" });
      }
    } catch (erro) {
      console.warn(`  ge (${idTime}): ${erro.message}`);
    }
    await espera(400);
  }

  // 2) Google Notícias: UOL e ESPN (e também ge, para quem não tem feed próprio).
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${busca} when:${DIAS}d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    for (const item of lerItens(await baixarTexto(url))) {
      const veiculo = veiculoDe(item.origem);
      if (!veiculo || (veiculo === "Globo Esporte" && FEEDS_GE[idTime])) continue;
      const titulo = limparTitulo(item.titulo);
      if (eDoTime(titulo, palavras)) encontradas.push({ ...item, titulo, veiculo });
    }
  } catch (erro) {
    console.warn(`  Google Notícias (${idTime}): ${erro.message}`);
  }
  await espera(400);

  // 3) Só as recentes, sem repetidas, das mais novas para as mais antigas.
  const vistas = new Set();
  const recentes = encontradas
    .filter((n) => n.titulo && n.link && n.data.getTime() >= limite)
    .sort((a, b) => b.data - a.data)
    .filter((n) => {
      const chave = n.titulo.toLowerCase();
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });

  // 4) Mistura os veículos: até 2 de cada um primeiro, depois completa com as mais novas.
  const escolhidas = [];
  for (const { nome } of VEICULOS) {
    escolhidas.push(...recentes.filter((n) => n.veiculo === nome).slice(0, 2));
  }
  for (const n of recentes) {
    if (escolhidas.length >= MAXIMO) break;
    if (!escolhidas.includes(n)) escolhidas.push(n);
  }
  return escolhidas
    .slice(0, MAXIMO)
    .sort((a, b) => b.data - a.data)
    .map((n) => ({ titulo: n.titulo, veiculo: n.veiculo, link: n.link, data: n.data.toISOString() }));
}
