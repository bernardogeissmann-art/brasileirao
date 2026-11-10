// atualizar_textos.js
// Escreve o texto "Situação atual" da página Meu Time para alguns times (ou todos) e guarda em
// data/meu-time.json, junto com a hora do texto (texto_em). As notícias de cada time não mudam.
//
// O texto é escrito pela IA (Claude Haiku 5.5, o modelo mais leve e barato, em texto_ia.js);
// sem a chave ANTHROPIC_API_KEY, ou se a IA falhar, sai com as frases prontas (texto.js).
// Ninguém gasta IA visitando o site: o texto fica guardado e o site só lê o arquivo.
//
// Usos (na pasta do projeto):
//     node scripts/meu_time/atualizar_textos.js --times gremio,internacional
//         só estes times, e só se o último jogo deles já tiver resultado (usado depois dos jogos);
//     node scripts/meu_time/atualizar_textos.js --depois-dos-jogos
//         todo time que jogou depois do último texto (a "rede de segurança" da madrugada);
//     node scripts/meu_time/atualizar_textos.js --todos
//     node scripts/meu_time/atualizar_textos.js --times briga
//         todos os times numa briga da reta final (título, acesso ou rebaixamento; veja site/js/briga.js)

import { fileURLToPath } from "node:url";
import { carregarContexto, lerMeuTime, salvarMeuTime, RAIZ } from "./contexto.js";
import { escreverTexto } from "./texto.js";
import { criarCliente, escreverTextoComIA, chaveRecusada } from "./texto_ia.js";

// No seu computador, a chave da IA fica no arquivo .env; esta linha copia o que está lá para
// as variáveis de ambiente. No GitHub não existe .env (a chave vem dos "secrets"): tudo bem.
try { process.loadEnvFile(new URL(".env", RAIZ)); } catch { /* sem .env */ }

const porData = (a, b) => b.data.localeCompare(a.data);   // do mais recente para o mais antigo

// O jogo mais recente de um time que já começou (pelo horário marcado), com ou sem resultado.
function ultimoJogoIniciado(jogos, id, agora) {
  return jogos.filter((j) => (j.mandante === id || j.visitante === id) && new Date(j.data) <= agora
    && j.status_fonte !== "POSTPONED").sort(porData)[0] ?? null;
}

// O jogo mais recente de um time que já tem resultado.
function ultimoJogoComResultado(jogos, id) {
  return jogos.filter((j) => j.disputado && (j.mandante === id || j.visitante === id)).sort(porData)[0] ?? null;
}

// Escolhe os times conforme o pedido (veja "Usos" no topo do arquivo).
export function escolherTimes(pedido, jogos, conteudo, ids, agora = new Date()) {
  if (pedido.todos) return ids;
  if (pedido.depoisDosJogos) {
    return ids.filter((id) => {
      const ultimo = ultimoJogoComResultado(jogos, id);
      const textoEm = conteudo.times?.[id]?.texto_em;
      return ultimo && (!textoEm || new Date(textoEm) < new Date(ultimo.data));
    });
  }
  // --times: só os que já têm o resultado do último jogo (senão o texto falaria do jogo como se não tivesse acontecido).
  return (pedido.times ?? []).filter((id) => {
    const ultimo = ultimoJogoIniciado(jogos, id, agora);
    if (ultimo && !ultimo.disputado) {
      console.log(`${id}: o resultado do último jogo ainda não chegou; fica para a próxima rodada.`);
      return false;
    }
    return ids.includes(id);
  });
}

// Escreve e guarda os textos dos times indicados. Devolve quantos textos foram escritos.
export async function atualizarTextos(escolhidos, contexto = carregarContexto(), conteudo = lerMeuTime()) {
  if (escolhidos.length === 0) return 0;
  const agora = new Date();
  const dia = agora.toISOString().slice(0, 10);
  const cliente = criarCliente();
  if (!cliente) console.log("Sem a chave ANTHROPIC_API_KEY: os textos saem com as frases prontas.");
  let falhasSeguidas = 0;   // se a IA falhar 3 vezes seguidas, desistimos dela nesta rodada

  for (const id of escolhidos) {
    const info = contexto.montarInfo(id);
    const atual = conteudo.times[id] ?? {};
    const noticias = atual.noticias ?? [];
    let texto = null;
    let autor = "frases";
    if (cliente && falhasSeguidas < 3) {
      try {
        texto = await escreverTextoComIA(cliente, info, noticias, dia);
        autor = "ia";
        falhasSeguidas = 0;
      } catch (erro) {
        falhasSeguidas = chaveRecusada(erro) ? 3 : falhasSeguidas + 1;
        console.warn(`${id}: a IA falhou (${erro.message}). Usando as frases prontas.`);
      }
    }
    texto ??= escreverTexto(info, noticias, dia);
    conteudo.times[id] = { ...atual, texto, autor, texto_em: agora.toISOString() };
    console.log(`${id}: texto novo (${autor === "ia" ? "IA" : "frases prontas"})`);
  }
  salvarMeuTime(conteudo);
  return escolhidos.length;
}

// Rodando direto (e não importado por outro arquivo).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const indice = args.indexOf("--times");
  const pedido = {
    todos: args.includes("--todos"),
    depoisDosJogos: args.includes("--depois-dos-jogos"),
    times: indice >= 0 ? (args[indice + 1] ?? "").split(",").filter(Boolean) : null,
  };
  const contexto = carregarContexto();
  const conteudo = lerMeuTime();
  // "briga" na lista vira todos os times que estão numa briga da reta final.
  if (pedido.times?.includes("briga")) {
    const naBriga = Object.keys(contexto.times).filter((id) => contexto.montarInfo(id).brigas.length > 0);
    pedido.times = [...pedido.times.filter((id) => id !== "briga"), ...naBriga];
    console.log(`Times numa briga da reta final: ${naBriga.join(", ")}`);
  }
  const escolhidos = escolherTimes(pedido, contexto.jogos.jogos, conteudo, Object.keys(contexto.times));
  const n = await atualizarTextos(escolhidos, contexto, conteudo);
  console.log(n ? `Textos escritos: ${n}` : "Nenhum texto para escrever agora.");
}
