/* =============================================================================
   ALIEN POCHO — MISIÓN / PUZZLE (data/mission.js)
   -----------------------------------------------------------------------------
   La TERCERA capa de datos, separada de las otras dos:
     - data/assets.js → QUÉ SON las cosas (identidad, física, dibujo).
     - data/rooms.js  → DÓNDE están (layout de salas y conexiones).
     - data/mission.js→ QUÉ hay que LOGRAR (la meta del puzzle).

   Hoy la meta es: colocar cada circuito en su zócalo. El TOTAL no se hardcodea: se DERIVA del
   mapa (nº de zócalos colocables). Este es el hogar de metas más ricas a futuro (dependencias
   entre puzzles, hitos de historia, gating de puertas).

   "Qué circuito pide cada zócalo" NO vive aquí: es dato de instancia del zócalo (data/rooms.js,
   campo `requires`), porque va ligado a su posición. Aquí vive la CONDICIÓN GLOBAL de victoria.

   Módulo HOJA y PURO: sin imports ni DOM; recibe los datos por parámetro (corre en Node/tests).
   ============================================================================= */
"use strict";

/* Descriptor de la misión (ampliable: más adelante, lista de objetivos, dependencias, etc.). */
export const MISSION = { goal: "fill-all-sockets" };

/* Nº de objetivos del puzzle = zócalos colocables en TODO el mundo. Fuente única del total de
   circuitos a colocar (mata el antiguo `circuitsTotal` hardcodeado). */
export function missionTotal(rooms) {
  let n = 0;
  for (const r of Object.values(rooms)) n += (r.sockets || []).length;
  return n;
}

/* ¿Misión cumplida? Cuando se han colocado todos los circuitos. */
export function missionComplete(game) { return game.circuits >= game.circuitsTotal; }
