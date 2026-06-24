/* =============================================================================
   ALIEN POCHO — MOTOR DE MUNDO (world.js)
   -----------------------------------------------------------------------------
   Interpreta los datos del mapa (data/rooms.js):
     - makeRoom: aplica límites de tamaño y clona los arrays mutables (objetos/zócalos…)
       para que cada partida arranque limpia.
     - buildWorld: resuelve la paleta por índice, construye todas las salas y calcula
       el PLANO CENITAL (wx,wy) para el minimapa.
   No sabe de render ni de física.
   ============================================================================= */
"use strict";

import { INKS, INK2 } from "./palette.js";
import { ROOMS, START } from "./data/rooms.js";
import { ASSETS, assetBox, assetRef, socketTop, propAsset, assetHas } from "./data/assets.js";   // registro + huellas/anclaje/traits

/* Construye una sala a partir de su definición (datos).
   Límites de tamaño: ancho/largo ∈ [3,13] y ancho+largo ≤ 16 (para que el rombo y el HUD
   siempre quepan en pantalla). Se recortan si se exceden.
   Clona blocks/objects/sockets/hazards (y sus elementos): se mutan en partida (empujar/coger,
   activar zócalos) y `resetGame` reconstruye el mundo; sin clonar arrastraría estado. */
export function makeRoom(o) {
  let w = Math.min(13, Math.max(3, o.w || 8));
  let h = Math.min(13, Math.max(3, o.h || 8));
  if (w + h > 16) { if (w >= h) w = 16 - h; else h = 16 - w; }
  return {
    w, h,
    objects: (o.objects || []).map(e => ({ ...e })),   // ÚNICA cubeta de lo colocable no-estructural (bloques + móviles)
    sockets: (o.sockets || []).map(e => ({ ...e })),
    hazards: (o.hazards || []).map(e => ({ ...e })),
    ink: o.ink, ink2: o.ink2, exits: o.exits || {}, name: o.name || "",
    wallTile: o.wallTile   // variante de panal por sala (opcional; si undefined → global WALL_TILE)
  };
}

/* Asset id de una entrada de `room.objects`. Un circuito que solo trae `shape` se resuelve a
   "prop_<shape>"; cualquier otro móvil trae `asset` explícito (p.ej. computer). */
export function objAsset(o) { return o.asset || propAsset(o.shape); }

/* ¿El dato `o` tiene el trait? Combina los traits del ASSET con los de INSTANCIA (o.traits): así un mismo
   asset (p. ej. `cube`) es fijo por defecto pero, si la instancia añade `movable`/`falls`, se vuelve empujable
   y cae. El COMPORTAMIENTO lo decide el trait, no la cubeta. Lo usan empuje (player) y gravedad (physics). */
export function thingHas(o, trait) { return assetHas(objAsset(o), trait) || !!(o.traits && o.traits[trait]); }

/* AABB de mundo {x0,y0,z0,x1,y1,z1} de un asset colocado con su anclaje en (ax,ay,az).
   Deriva de assetBox/assetRef (frame local) + offset del anclaje. `top` opcional sobreescribe
   la cima (zócalo activo). La usan a la vez render (painter) y física (sólidos). */
function placeAabb(id, ax, ay, az, top) {
  const b = assetBox(id), r = assetRef(id);
  const x0 = b.x + (ax - r.x), y0 = b.y + (ay - r.y), z0 = b.z + (az - r.z);
  return { x0, y0, z0, x1: x0 + b.w, y1: y0 + b.l, z1: top != null ? top : z0 + b.h };
}

/* LISTA UNIFORME de placements de la sala (lo COLOCABLE; suelo/pared/puerta van aparte).
   Fuente única del mapeo "cubetas del mapa → assets", que consumen render y física. Se calcula
   en vivo desde las cubetas (objetos que se mueven, zócalos que se activan). Cada placement:
     { asset, x, y, z, ...estado, src?, aabb }  (x,y,z = anclaje en mundo; aabb = caja painter/sólido). */
export function roomThings(room) {
  const t = [];
  for (const o of room.objects) {                                // ÚNICA cubeta: bloques (cube), circuitos, ordenadores…
    const id = objAsset(o), a = ASSETS[id]; if (!a) continue;    // el comportamiento lo deciden los TRAITS, no la cubeta
    const center = a.anchor === "center";
    const ax = o.x != null ? o.x : (center ? o.cx + 0.5 : o.cx); // posición por celda (cx,cy) o por punto continuo (x,y)
    const ay = o.y != null ? o.y : (center ? o.cy + 0.5 : o.cy);
    const az = o.z || 0;
    for (let k = 0; k < (o.h || 1); k++) {                       // h = pila de copias (terreno fijo); móviles = 1
      const pz = az + k;
      t.push({ asset: id, x: ax, y: ay, z: pz, shape: o.shape, src: o, aabb: placeAabb(id, ax, ay, pz) });
    }
  }
  for (const s of room.sockets) {                                // zócalos (vivos: al llenarse suben)
    const cx = s.cx + 0.5, cy = s.cy + 0.5, z = s.z || 0;        // requires = circuito que pide, filled = el puesto
    t.push({ asset: "socket", x: cx, y: cy, z, requires: s.requires, filled: s.filled, src: s,
             aabb: placeAabb("socket", cx, cy, z, socketTop(s)) });
  }
  for (const h of room.hazards)                                  // pinchos (decorativos, estáticos)
    t.push({ asset: "spikes", x: h.cx + 0.5, y: h.cy + 0.5, z: 0, src: h,
             aabb: placeAabb("spikes", h.cx + 0.5, h.cy + 0.5, 0) });
  return t;
}

/* Construye el mundo entero: resuelve color por índice de paleta y coloca cada sala en un
   PLANO CENITAL coherente (sin solapes) para el minimapa. El layout parte de la sala inicial
   y pega cada vecina ALINEANDO la puerta (centro con centro). */
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
