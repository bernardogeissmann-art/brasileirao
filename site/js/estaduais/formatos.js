// formatos.js
// A lista dos campeonatos que o site simula com este motor: os estaduais e as copas
// (Sul-Americana, Libertadores e Copa do Brasil). Para acrescentar um novo (ex.: o Catarinense 2027), crie o
// arquivo do formato e acrescente uma linha aqui.

import { CATARINENSE_2026 } from "./catarinense-2026.js";
import { GAUCHO_2026 } from "./gaucho-2026.js";
import { PARANAENSE_2026 } from "./paranaense-2026.js";
import { PAULISTA_2026 } from "./paulista-2026.js";
import { SULAMERICANA_2026 } from "../copas/sulamericana-2026.js";
import { LIBERTADORES_2026 } from "../copas/libertadores-2026.js";
import { COPA_DO_BRASIL_2026 } from "../copas/copa-do-brasil-2026.js";

export const FORMATOS = {
  [CATARINENSE_2026.id]: CATARINENSE_2026,
  [GAUCHO_2026.id]: GAUCHO_2026,
  [PARANAENSE_2026.id]: PARANAENSE_2026,
  [PAULISTA_2026.id]: PAULISTA_2026,
  [SULAMERICANA_2026.id]: SULAMERICANA_2026,
  [LIBERTADORES_2026.id]: LIBERTADORES_2026,
  [COPA_DO_BRASIL_2026.id]: COPA_DO_BRASIL_2026,
};
