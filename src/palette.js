/* =============================================================================
   ALIEN POCHO — PALETA (palette.js)
   -----------------------------------------------------------------------------
   Datos de color del juego (no dibujo): la tinta PRIMARIA de cada sala + su
   SECUNDARIA, y el color fijo del robot. Módulo HOJA (no importa nada) → lo usan
   assets.js (dibujo), world.js (resuelve color por índice) y main.js (paleta de menú).
   CRITERIO: el secundario es el COMPLEMENTARIO del primario (hue+180°) en versión
   clara/neón → contrasta como acento sin chillar.
   UNIFICACIÓN: solo hay 3 PAREJAS base. Las 6 paletas salen de usar cada pareja en sus dos
   sentidos: las paletas 0-2 son la pareja "normal" (primario/secundario) y las 3-5 son LA
   MISMA pareja INVERTIDA (secundario/primario). Así cada color aparece una vez como tinta y
   otra como acento, sin los casi-duplicados que había antes (dos verdes, naranja≈ámbar, etc.).
   ============================================================================= */
"use strict";

//                    primario      secundario (complementario claro)
const PAIRS = [
  ["#36c8ff", "#ffd27a"],   // cian    ↔ ámbar
  ["#d7d98a", "#aab0ff"],   // oliva   ↔ azul-violeta
  ["#e070c5", "#86eaa0"],   // magenta ↔ verde
];
const PRIM = PAIRS.map(p => p[0]), SEC = PAIRS.map(p => p[1]);
export const INKS = [...PRIM, ...SEC];   // 0-2: pareja normal · 3-5: la misma pareja invertida
export const INK2 = [...SEC, ...PRIM];

export const ROBOT_INK = "#6fd0ff";   // el robot siempre azul claro
