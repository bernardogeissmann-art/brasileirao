// videos.js
// Regras dos vídeos do YouTube da página Meu Time, usadas pela página (meu-time.js) e pelo
// script que guarda os vídeos de cada time (scripts/meu_time/atualizar_videos.js).
//
// Cada entrada do data/canais-youtube.json é um canal ("UC..."), uma playlist ("PL...") ou um
// vídeo avulso (tipo "destaque"). Para canais e playlists, o site guarda a lista dos vídeos mais
// recentes em data/meu-time.json, e essa lista só muda 20 horas depois de cada jogo do time.

export const CODIGO_CANAL = /^UC[\w-]{22}$/;
export const CODIGO_VIDEO = /^[\w-]{11}$/;
export const CODIGO_PLAYLIST = /^PL[\w-]{16,40}$/;

// A entrada tem um código válido?
export function entradaValida(c) {
  if (c.tipo === "destaque") return CODIGO_VIDEO.test(c.video ?? "");
  return c.playlist ? CODIGO_PLAYLIST.test(c.playlist) : CODIGO_CANAL.test(c.canal ?? "");
}

// A lista do YouTube de uma entrada: a playlist escolhida ou, para um canal, a lista "UULF" +
// código do canal sem o "UC" (os vídeos do canal, sem Shorts nem lives). Vídeo avulso: nenhuma.
export function listaDoYouTube(c) {
  if (c.tipo === "destaque" || !entradaValida(c)) return null;
  return c.playlist ?? `UULF${c.canal.slice(2)}`;
}

// O endereço do player e o link "ver no YouTube" de uma entrada. "guardados" são os vídeos
// guardados para ela (do mais novo para o mais velho); sem eles, o player toca a lista do
// próprio YouTube, que está sempre com os mais recentes.
// O endereço youtube-nocookie.com é o "modo de privacidade reforçada" do YouTube (não grava
// cookies de quem só abre a página).
export function playerDaEntrada(c, guardados = []) {
  const BASE = "https://www.youtube-nocookie.com/embed/";
  if (c.tipo === "destaque") {
    return { player: BASE + c.video, link: { endereco: `https://www.youtube.com/watch?v=${c.video}`, texto: "Ver no YouTube" } };
  }
  const link = c.playlist
    ? { endereco: `https://www.youtube.com/playlist?list=${c.playlist}`, texto: "Ver a playlist no YouTube" }
    : { endereco: `https://www.youtube.com/channel/${c.canal}/videos`, texto: "Ver o canal no YouTube" };
  const videos = guardados.filter((v) => CODIGO_VIDEO.test(v));
  if (videos.length === 0) return { player: `${BASE}videoseries?list=${listaDoYouTube(c)}`, link };
  // Toca o primeiro vídeo e, depois dele, os outros (o parâmetro "playlist" monta a fila).
  const fila = videos.length > 1 ? `?playlist=${videos.slice(1).join(",")}` : "";
  return { player: BASE + videos[0] + fila, link };
}
