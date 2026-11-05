// calcular_chances.js
// Calcula as chances de cada time em cada momento de um campeonato estadual e salva em
// data/estaduais/<campeonato>/chances.json. Usa exatamente o mesmo motor de simulação
// do site (site/js/estaduais/), só que rodando no computador, com o Node.js.
// Assim a página abre na hora, sem precisar simular nada no celular de quem visita.
//
// Como rodar (na pasta do projeto, depois do estimar_estadual.py):
//     node scripts/estaduais/calcular_chances.js catarinense-2026

import { readFileSync, writeFileSync } from "node:fs";
import { simularMomento, N_SIMULACOES_ESTADUAL } from "../../site/js/estaduais/motor.js";
import { FORMATOS } from "../../site/js/estaduais/formatos.js";

// process.argv é a lista do que foi digitado: [node, script, campeonato].
const campeonato = process.argv[2];
const formato = FORMATOS[campeonato];
if (!formato) {
  console.error(`Uso: node scripts/estaduais/calcular_chances.js <campeonato>. Conhecidos: ${Object.keys(FORMATOS).join(", ")}`);
  process.exit(1);
}

const pasta = new URL(`../../data/estaduais/${campeonato}/`, import.meta.url);
const ler = (arquivo) => JSON.parse(readFileSync(new URL(arquivo, pasta), "utf-8"));
const dados = ler("jogos.json");
const modelos = ler("modelos.json");

const inicio = performance.now();
const momentos = modelos.momentos.map((momento) => {
  // Semente fixa: rodando de novo com os mesmos dados, os números saem iguais.
  const resultado = simularMomento(dados, momento, formato, { n: N_SIMULACOES_ESTADUAL, semente: 2026 });
  if (resultado.avisos.length > 0) {
    console.warn(`Aviso em ${momento.id}: ${resultado.avisos.join("; ")}`);
  }
  return { id: momento.id, rotulo: momento.rotulo, curto: momento.curto, ate: momento.ate, times: resultado.times };
});

const saida = {
  competicao: dados.competicao,
  temporada: dados.temporada,
  dados_baixados_em: dados.baixado_em,
  calculado_em: new Date().toISOString(),
  simulacoes: N_SIMULACOES_ESTADUAL,
  momentos,
};
writeFileSync(new URL("chances.json", pasta), JSON.stringify(saida, null, 1), "utf-8");
console.log(`Salvo: data/estaduais/${campeonato}/chances.json (${momentos.length} momentos, ` +
  `${((performance.now() - inicio) / 1000).toFixed(1)} s)`);
