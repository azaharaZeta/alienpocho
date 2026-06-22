/* =============================================================================
   ALIEN POCHO — MOTOR DE MUNDO (world.js)
   -----------------------------------------------------------------------------
   El código que INTERPRETA los datos del mapa (data/rooms.js):
     - makeRoom: aplica límites de tamaño, deriva el set `solid` y CLONA los arrays
       mutables (objetos/zócalos…) para que cada partida arranque limpia.
     - buildWorld: resuelve la paleta por índice, construye todas las salas y calcula
       el PLANO CENITAL (wx,wy) para el minimapa.
   No sabe de render ni de física: solo arma el mundo a partir de los datos.
   ============================================================================= */
"use strict";

import { INKS, INK2 } from "./palette.js";
import { ROOMS, START } from "./data/rooms.js";

/* Construye una sala a partir de su definición (datos).
   Salas rectangulares con LÍMITES: ancho/largo ∈ [3,13] y ancho+largo ≤ 16 (para que
   el rombo y el HUD adaptado siempre quepan en pantalla). Se recortan si se exceden.

   CLONA blocks/objects/sockets/hazards (y sus elementos): durante la partida se
   mutan (empujar/coger objetos, activar zócalos), y `resetGame` reconstruye el mundo;
   sin clonar, una nueva partida heredaría el estado mutado de los datos compartidos. */
export function makeRoom(o) {
  let w = Math.min(13, Math.max(3, o.w || 8));
  let h = Math.min(13, Math.max(3, o.h || 8));
  if (w + h > 16) { if (w >= h) w = 16 - h; else h = 16 - w; }
  const blocks = (o.blocks || []).map(b => ({ ...b }));
  const solid = new Set();
  for (const b of blocks)
    if (b.x >= 0 && b.x < w && b.y >= 0 && b.y < h) solid.add(b.x + "," + b.y);
  return {
    w, h, blocks, solid,
    objects: (o.objects || []).map(e => ({ ...e })),
    sockets: (o.sockets || []).map(e => ({ ...e })),
    hazards: (o.hazards || []).map(e => ({ ...e })),
    ink: o.ink, ink2: o.ink2, exits: o.exits || {}, name: o.name || "",
    wallTile: o.wallTile   // variante de panal por sala (opcional; si undefined → global WALL_TILE)
  };
}

/* Construye el mundo entero desde los datos: resuelve color por índice de paleta y
   coloca cada sala en un PLANO CENITAL coherente (sin solapes) para el minimapa real.
   El layout parte de la sala inicial y pega cada vecina ALINEANDO la puerta (centro
   con centro, igual que el recentrado de checkExits). */
export function buildWorld() {
  const rooms = {};
  for (const [key, def] of Object.entries(ROOMS)) {
    rooms[key] = makeRoom({
      ...def,
      ink:  INKS[def.paletteIndex],
      ink2: INK2[def.paletteIndex]
    });
  }

  (function layout() {
    rooms[START].wx = 0; rooms[START].wy = 0;
    const seen = new Set([START]), q = [START];
    while (q.length) {
      const r = rooms[q.shift()];
      for (const [dir, t] of Object.entries(r.exits)) {
        const n = rooms[t]; if (!n || seen.has(t)) continue; seen.add(t); q.push(t);
        if (dir === "xp")      { n.wx = r.wx + r.w;  n.wy = r.wy + r.h / 2 - n.h / 2; }
        else if (dir === "xm") { n.wx = r.wx - n.w;  n.wy = r.wy + r.h / 2 - n.h / 2; }
        else if (dir === "yp") { n.wy = r.wy + r.h;  n.wx = r.wx + r.w / 2 - n.w / 2; }
        else if (dir === "ym") { n.wy = r.wy - n.h;  n.wx = r.wx + r.w / 2 - n.w / 2; }
      }
    }
  })();

  return { rooms, start: START };
}
