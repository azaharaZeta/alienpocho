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

   Aquí vive también QUÉ circuito pide cada zócalo (`MISSION.requires`, por el `id` del zócalo en
   data/rooms.js) y el ARRANQUE del robot (`MISSION.start`): la misión decide cómo va el juego.

   Módulo HOJA y PURO: sin imports ni DOM; recibe los datos por parámetro (corre en Node/tests).
   ============================================================================= */
"use strict";

/* Descriptor de la misión (ampliable: más adelante, lista de objetivos, dependencias, etc.).
   `start` = ARRANQUE del robot: sala + posición + orientación. La MISIÓN decide dónde empieza el juego.
   `room` debe ser una clave de data/rooms.js y `x,y` caer dentro de esa sala. Lo consumen world.js
   (raíz del minimapa = `start.room`) y player.js / game.resetGame (posición). */
export const MISSION = {
  goal: "fill-all-sockets",
  start: { room: "0,0", x: 3.5, y: 2.5, facing: 0 },   // room = sala inicial · x,y = centro de celda · facing 0:+x 1:+y 2:-x 3:-y
  // QUÉ circuito pide cada zócalo (por su `id` en data/rooms.js). El total se deriva del nº de zócalos.
  // Equilibrio: tantos circuitos de cada forma como zócalos de esa forma (aquí: 2 cube, 2 pyramid, 1 dome, 1 cylinder).
  requires: { e1: "cube", a4: "cube", gal: "cylinder", nudo: "dome", cond: "pyramid", d3: "pyramid" },
};

/* Nº de objetivos del puzzle = zócalos colocables en TODO el mundo. Fuente única del total de
   circuitos a colocar (derivado del mapa, no hardcodeado). */
export function missionTotal(rooms) {
  let n = 0;
  for (const r of Object.values(rooms)) n += (r.sockets || []).length;
  return n;
}

/* ¿Misión cumplida? Cuando se han colocado todos los circuitos. */
export function missionComplete(game) { return game.circuits >= game.circuitsTotal; }
