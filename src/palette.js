/* =============================================================================
   ALIEN POCHO — PALETA (palette.js)
   -----------------------------------------------------------------------------
   Datos de color del juego (no dibujo): la tinta PRIMARIA de cada sala + su
   SECUNDARIA, y el color fijo del robot. Módulo HOJA (no importa nada) → lo usan
   assets.js (dibujo), world.js (resuelve color por índice) y main.js (paleta de menú).
   CRITERIO: el secundario es el COMPLEMENTARIO del primario (hue+180°) en versión
   clara/neón → contrasta como acento sin chillar.
   ============================================================================= */
"use strict";

//                          azul/cian   amarillo-ol  magenta    verde      naranja    violeta
export const INKS = ["#36c8ff", "#d7d98a", "#e070c5", "#79e6a6", "#ff9d5c", "#b9a6ff"];
export const INK2 = ["#ffd27a", "#aab0ff", "#86eaa0", "#f59ad6", "#79d0ff", "#d8e68a"];
//                          ámbar       azul-viol   verde      rosa       cian       amarillo-verd

export const ROBOT_INK = "#6fd0ff";   // el robot siempre azul claro
