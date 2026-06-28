/* =============================================================================
   ALIEN POCHO — PALETA (palette.js)
   -----------------------------------------------------------------------------
   Datos de color (no dibujo): tinta PRIMARIA y SECUNDARIA de cada sala + color
   fijo del robot. Módulo HOJA (no importa nada). El secundario es el
   COMPLEMENTARIO claro del primario (acento que contrasta sin chillar).
   3 PAREJAS base → 6 paletas: 0-2 normal (primario/secundario), 3-5 la misma
   pareja invertida. Así cada color sale una vez como tinta y otra como acento.
   ============================================================================= */
"use strict";

//                    primario      secundario (complementario claro)
const PAIRS = [
  ["#36c8ff", "#ffd27a"],   // cian    ↔ ámbar
  ["#c8d24f", "#a594ff"],   // lima    ↔ violeta   (subida de croma: antes oliva/azul-violeta, demasiado pastel)
  ["#ec84d2", "#86eaa0"],   // magenta ↔ verde     (magenta un punto más claro, para igualar luminancia)
];
const PRIM = PAIRS.map(p => p[0]), SEC = PAIRS.map(p => p[1]);
export const INKS = [...PRIM, ...SEC];   // 0-2: pareja normal · 3-5: invertida
export const INK2 = [...SEC, ...PRIM];

export const ROBOT_INK = "#6fd0ff";   // el robot siempre azul claro
