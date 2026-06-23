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
import { assetBox, assetRef, socketTop } from "./data/assets.js";   // huellas/anclaje para armar los placements

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

/* AABB de mundo {x0,y0,z0,x1,y1,z1} de un asset colocado con su ANCLAJE en (ax,ay,az).
   Deriva de assetBox/assetRef (frame local del asset) + el offset del anclaje. `top` opcional
   sobreescribe la cima (zócalo activo). La usan a la vez render (painter) y física (sólidos). */
function placeAabb(id, ax, ay, az, top) {
  const b = assetBox(id), r = assetRef(id);
  const x0 = b.x + (ax - r.x), y0 = b.y + (ay - r.y), z0 = b.z + (az - r.z);
  return { x0, y0, z0, x1: x0 + b.w, y1: y0 + b.l, z1: top != null ? top : z0 + b.h };
}

/* LISTA UNIFORME de placements de la sala (lo COLOCABLE; la cáscara suelo/pared/puerta va aparte).
   ES LA FUENTE ÚNICA del mapeo "cubetas del mapa → assets": render y física la consumen
   GENÉRICAMENTE (sin enumerar tipos). Se calcula EN VIVO desde las cubetas (los objetos se mueven,
   los zócalos se activan) → nunca se desincroniza. Cada placement:
     { asset, x, y, z, ...estado, src?, aabb }  (x,y,z = anclaje en mundo; aabb = caja painter/sólido). */
export function roomThings(room) {
  const t = [];
  for (const b of room.blocks)                                   // bloque = un cubo por capa
    for (let k = 0; k < (b.h || 1); k++) {
      const z = (b.z || 0) + k;
      t.push({ asset: "cube", x: b.x, y: b.y, z, aabb: placeAabb("cube", b.x, b.y, z) });
    }
  for (const o of room.objects)                                  // circuitos transportables (vivos: se mueven)
    t.push({ asset: "prop_" + o.shape, x: o.x, y: o.y, z: o.z, shape: o.shape, src: o,
             aabb: placeAabb("prop_" + o.shape, o.x, o.y, o.z) });
  for (const s of room.sockets) {                                // zócalos (vivos: se activan → más altos)
    const cx = s.cx + 0.5, cy = s.cy + 0.5, z = s.z || 0;
    t.push({ asset: "socket_" + s.shape, x: cx, y: cy, z, shape: s.shape, active: s.active, src: s,
             aabb: placeAabb("socket_" + s.shape, cx, cy, z, socketTop(s)) });
  }
  for (const h of room.hazards)                                  // pinchos (decorativos, estáticos)
    t.push({ asset: "spikes", x: h.cx + 0.5, y: h.cy + 0.5, z: 0, src: h,
             aabb: placeAabb("spikes", h.cx + 0.5, h.cy + 0.5, 0) });
  return t;
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
