/* =============================================================================
   ALIEN POCHO — OCLUSIÓN DE PUERTAS (occlusion.js)
   -----------------------------------------------------------------------------
   Identifica qué posiciones quedan FLAGRANTEMENTE detrás del marco de una puerta
   FRONTAL (xp/yp). Esas puertas PROTRUYEN del borde (x≥w / y≥h) y son ALTAS (WALL_H),
   así que el painter las pinta SIEMPRE delante de lo que hay dentro de la sala y tapan
   lo que caiga en su columna iso (la diagonal x−y del vano). Un asset ahí se ve a medias
   o no se ve → hay que evitarlo.

   (Las puertas de FONDO xm/ym retroceden tras el muro y se pintan detrás → no tapan nada;
   no se consideran.)

   USOS:
     - Auditar el mapa hecho a mano (data/rooms.js) — lo fija test/mission.mjs.
     - El GENERADOR de mapas (roguelike, a futuro): `isBehindDoor`/`doorBlockedCells` dicen
       dónde NO colocar nada.

   Módulo PURO (sin DOM, sin canvas): corre en Node/tests. Usa la MISMA proyección que el
   motor (engine.projector) y la geometría de la cáscara, leídas del registro/config.
   ============================================================================= */
"use strict";

import { POPT } from "./config.js";              // dims de tesela/proyección (única fuente)
import { DOOR, WALL_H } from "./data/assets.js"; // grosor/vano de puerta + alto de muro

const { TILE_W: TW, TILE_H: TH, BLOCK_H: BH } = POPT;
const doorSpan = (n) => [n / 2 - DOOR.SPAN_HALF, n / 2 + DOOR.SPAN_HALF];

/* AABB de mundo {x0..z1} → caja de PANTALLA {xMin,xMax,yMin,yMax}, proyectando sus 8 esquinas
   con la proyección iso del motor (sin offset: la oclusión no depende de dónde esté el HUD). */
function screenAABB(b) {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
    const sx = (x - y) * (TW / 2), sy = (x + y) * (TH / 2) - z * BH;
    if (sx < xMin) xMin = sx; if (sx > xMax) xMax = sx;
    if (sy < yMin) yMin = sy; if (sy > yMax) yMax = sy;
  }
  return { xMin, xMax, yMin, yMax };
}

/* Cajas-mundo del OCLUYENTE de cada puerta FRONTAL: el MARCO ENTERO (todo el vano, protruido y alto).
   Conservador A PROPÓSITO: el sprite real de la puerta (marco + arco) es más ancho que los postes y se
   pinta delante, así que tapa toda su columna iso (no solo justo tras los postes). Mejor dejar una celda
   vacía que esconder medio asset. Mismo span/protrusión/alto que world.roomShell (front, side +1). */
export function frontDoorOccluders(room) {
  const out = [], { exits, w, h } = room, T = DOOR.T;
  if (exits.yp) { const [s0, s1] = doorSpan(w); out.push({ x0: s0, y0: h, z0: 0, x1: s1, y1: h + T, z1: WALL_H }); }
  if (exits.xp) { const [s0, s1] = doorSpan(h); out.push({ x0: w, y0: s0, z0: 0, x1: w + T, y1: s1, z1: WALL_H }); }
  return out;
}

/* Solape (área) de dos cajas de pantalla. */
function overlapArea(a, b) {
  const ox = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
  const oy = Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin));
  return ox * oy;
}

/* Huella de un objeto de MUESTRA centrado en (x,y) sobre el suelo: representa "un asset cualquiera"
   para decidir si quedaría tapado (semilado y alto medios). */
const PROBE = { half: 0.3, h: 0.7 };
const probeBox = (x, y) => ({ x0: x - PROBE.half, y0: y - PROBE.half, z0: 0, x1: x + PROBE.half, y1: y + PROBE.half, z1: PROBE.h });

/* Profundidad iso (orden del painter): mayor x+y = más cerca de cámara (se pinta después). */
const depth = (b) => b.x1 + b.y1;

/* ¿La posición (x,y) cae detrás de alguna puerta frontal?
   El marco (que va por delante, mayor profundidad) tapa ≥ `cover` del sprite de muestra en pantalla.
   `cover` ∈ [0,1] (def. 0.4 = la puerta esconde ≥40% → incluye las ESQUINAS de la diagonal donde la
   puerta alta tapa la parte de abajo; con 0.5 esas esquinas se escapaban y un asset quedaba medio oculto). */
export function isBehindDoor(room, x, y, cover = 0.4) {
  const doors = frontDoorOccluders(room); if (!doors.length) return false;
  const pb = probeBox(x, y), ps = screenAABB(pb);
  const pa = (ps.xMax - ps.xMin) * (ps.yMax - ps.yMin);
  for (const d of doors) {
    if (depth(d) <= depth(pb)) continue;          // la puerta debe ir DELANTE (más profundidad) para tapar
    if (overlapArea(ps, screenAABB(d)) >= cover * pa) return true;
  }
  return false;
}

/* CELDAS (índice cx,cy; centro = cx+0.5) de la sala que caen detrás de una puerta frontal.
   Para auditar el mapa y para que el generador (roguelike) sepa dónde NO colocar. */
export function doorBlockedCells(room, cover = 0.4) {
  const out = [];
  for (let cy = 0; cy < room.h; cy++)
    for (let cx = 0; cx < room.w; cx++)
      if (isBehindDoor(room, cx + 0.5, cy + 0.5, cover)) out.push({ cx, cy });
  return out;
}
