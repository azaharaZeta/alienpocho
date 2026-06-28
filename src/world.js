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
import { ROOMS } from "./data/rooms.js";
import { MISSION } from "./data/mission.js";   // sala inicial = MISSION.start.room (la decide la misión)
import { ASSETS, assetBox, assetRef, socketTop, propAsset, assetHas, WALL_H, DOOR } from "./data/assets.js";   // registro + huellas/anclaje/traits + geometría de cáscara
import { WALL_TILE } from "./config.js";   // variante de pared por defecto (id de asset de la cáscara)

/* Construye una sala a partir de su definición (datos).
   Límites de tamaño: ancho/largo ∈ [3,13] y ancho+largo ≤ 16 (para que el rombo y el HUD
   siempre quepan en pantalla). Se recortan si se exceden.
   Clona objects/sockets/hazards (y sus elementos): se mutan en partida (empujar/coger,
   activar zócalos) y `resetGame` reconstruye el mundo; sin clonar arrastraría estado. */
export function makeRoom(o) {
  // Dimensiones en {4,6,8}: PARES (redondeo ↑) y acotadas a [4,8]. Así la puerta (2 de ancho) cae
  // SIEMPRE centrada en celda entera → la pared se dibuja como módulos SVG sin recorte (ver draw.flatWall).
  let w = Math.min(8, Math.max(4, o.w || 8)); w += w & 1;
  let h = Math.min(8, Math.max(4, o.h || 8)); h += h & 1;
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
    const off = a.offset || { x: 0, y: 0 };                      // ancla = esquina (cx,cy) + offset, o punto continuo (x,y)
    const ax = o.x != null ? o.x : o.cx + off.x;
    const ay = o.y != null ? o.y : o.cy + off.y;
    const az = o.z || 0;
    for (let k = 0; k < (o.h || 1); k++) {                       // h = pila de copias (terreno fijo); móviles = 1
      const pz = az + k;
      t.push({ asset: id, x: ax, y: ay, z: pz, shape: o.shape, src: o, aabb: placeAabb(id, ax, ay, pz) });
    }
  }
  for (const s of room.sockets) {                                // zócalos (vivos: al llenarse suben)
    const cx = s.cx + 0.5, cy = s.cy + 0.5, z = s.z || 0;        // qué circuito PIDE lo decide la MISIÓN (por id); filled = el puesto
    t.push({ asset: "socket", x: cx, y: cy, z, requires: MISSION.requires[s.id], filled: s.filled, src: s,
             aabb: placeAabb("socket", cx, cy, z, socketTop(s)) });
  }
  for (const h of room.hazards)                                  // pinchos (decorativos, estáticos)
    t.push({ asset: "spikes", x: h.cx + 0.5, y: h.cy + 0.5, z: 0, src: h,
             aabb: placeAabb("spikes", h.cx + 0.5, h.cy + 0.5, 0) });
  return t;
}

/* ---- Geometría de BORDE (compartida por render y física): vano y tramos de pared ---- */
// Vano de puerta centrado en un borde de longitud n (ocupa 2 celdas exactas: SPAN_HALF=1).
export const doorSpan = (n) => [n / 2 - DOOR.SPAN_HALF, n / 2 + DOOR.SPAN_HALF];
// Tramos de pared de un borde de longitud n, partido por el vano `span` (o entero si no hay puerta).
export const wallSegs = (n, span) => span ? [[0, span[0]], [span[1], n]] : [[0, n]];

/* Caja-mundo {x0,y0,z0,x1,y1,z1} de una pieza de CÁSCARA en un borde. axis "x": corre a lo largo de x
   en el plano y=fixed; "y": a lo largo de y en x=fixed. [a0,a1] = extensión a lo largo del eje. depth =
   grosor (0 = pared PLANA con l=0; DOOR.T = marco de puerta). side<0 retrocede hacia −coord (puerta de
   FONDO, inset); side>0 protruye hacia +coord (puerta FRONTAL). Altura 0..WALL_H (del registro). */
function placeShellAabb(axis, fixed, a0, a1, depth = 0, side = -1) {
  const lo = side < 0 ? fixed - depth : fixed, hi = side < 0 ? fixed : fixed + depth;
  return axis === "x"
    ? { x0: a0, y0: lo, z0: 0, x1: a1, y1: hi, z1: WALL_H }
    : { x0: lo, y0: a0, z0: 0, x1: hi, y1: a1, z1: WALL_H };
}

/* Los dos POSTES sólidos de un marco de puerta (extremos del vano; dejan libre el hueco central).
   Se derivan de la caja del marco + DOOR.POST_W → el hueco coincide EXACTO con el dibujo (gen-doors) y
   con `inDoor` (semiancho passable = SPAN_HALF − POST_W). Es la huella sólida de la puerta. */
function doorPosts(axis, b) {
  const W = DOOR.POST_W;
  return axis === "x"
    ? [{ ...b, x1: b.x0 + W }, { ...b, x0: b.x1 - W }]
    : [{ ...b, y1: b.y0 + W }, { ...b, y0: b.y1 - W }];
}

/* CACHÉ de la cáscara por sala: la cáscara es ESTRUCTURAL e INVARIANTE durante la partida (depende solo de
   exits/w/h/wallTile, fijados en makeRoom y nunca mutados) pero se pide muchas veces por frame (física la
   consulta en cada colisión/apoyo, render una o dos). Se computa UNA vez por sala y se reutiliza. Clave por
   identidad de `room` (WeakMap) → resetGame crea salas nuevas = caché fresco automáticamente. Nadie muta los
   placements devueltos (render los lee, roomSolids copia campos), así que es seguro compartir el array.
   Los `things` (objetos) NO se cachean: SÍ mutan (empuje/gravedad/colocar) y deben verse al instante. */
const _shellCache = new WeakMap();

/* LISTA UNIFORME de la CÁSCARA estructural de la sala (paredes de fondo x=0/y=0 partidas por su vano +
   marcos de puerta). HERMANA de roomThings: emite los mismos placements { asset, aabb, ...estado } que
   consumen IGUAL render (painter, vía AP.drawAsset) y física (sólidos, vía roomSolids). Las puertas de
   FONDO (xm/ym) retroceden tras el plano del muro (side −1); las FRONTALES (xp/yp) protruyen del borde
   abierto (side +1). `src:"shell"` nunca es un objeto de room.objects (no choca consigo en empuje). */
export function roomShell(room) {
  const hit = _shellCache.get(room); if (hit) return hit;
  const t = [], { exits, w, h } = room, wallId = room.wallTile || WALL_TILE;
  const wallN = (ASSETS[wallId] && ASSETS[wallId].tile && ASSETS[wallId].tile.N) || 1;   // ancho del tile (celdas)
  // Ancla de la pieza = esquina de inicio del tramo en el plano del borde (a0, fixed) → mismo punto que el blit.
  const anchor = (axis, fixed, a0) => axis === "x" ? { x: a0, y: fixed, z: 0 } : { x: fixed, y: a0, z: 0 };
  // Pared TROCEADA por tile (N celdas): cada trozo es una caja LOCAL del painter, no un "slab" que abarca toda
  // la fila. (Un slab da una clave de profundidad falsa —su caja se extiende a toda la pared— → el robot en la
  // mitad alejada se ordena mal contra él. Troceado, cada celda ordena por su posición real, como un bloque.)
  const wall = (axis, fixed, a0, a1) => {
    for (let i = a0; i + wallN <= a1 + 1e-6; i += wallN)
      t.push({ asset: wallId, axis, fixed, a0: i, a1: i + wallN, tile: wallId, src: "shell",
               ...anchor(axis, fixed, i), aabb: placeShellAabb(axis, fixed, i, i + wallN) });
  };
  // La puerta se emite como DOS piezas (poste a0 / poste a1): cada una su caja = el poste (para que el painter
  // intercale al robot — delante del cercano, detrás del lejano) + un sólido. El drawer dibuja el MISMO sprite
  // recortado por el centro del vano (transparente) → unión = la puerta intacta, pero ordenada por poste.
  const door = (axis, fixed, a0, a1, side, hole) => {
    const aabb = placeShellAabb(axis, fixed, a0, a1, DOOR.T, side);
    const [pL, pR] = doorPosts(axis, aabb);
    // DINTEL: banda superior del vano (alto DOOR.LINTEL_H). Es a la vez:
    //  · SÓLIDO → frena el salto alto que se colaría por encima del paso (deja libre el hueco bajo); y
    //  · PIEZA PROPIA del painter, ordenada por SU caja (alta, ancho completo) → depthSort la pinta DELANTE
    //    de la cabeza del robot al saltar bajo la puerta (la ocluye), en vez de que el sprite la tape.
    const lintel = { ...aabb, z0: aabb.z1 - DOOR.LINTEL_H };
    const base = { asset: "door", axis, fixed, a0, a1, hole, src: "shell", ...anchor(axis, fixed, a0) };
    t.push({ ...base, half: "L", aabb: pL, solids: [pL] });
    t.push({ ...base, half: "R", aabb: pR, solids: [pR] });
    t.push({ ...base, half: "lintel", aabb: lintel, solids: [lintel] });
    // VACÍO negro del vano (solo puertas de FONDO `hole`): el hueco bajo el dintel, en el vano pasable.
    // Entra al painter como PIEZA NORMAL (su caja, inset en y<0/x<0, se ordena por x+y → SIEMPRE detrás del
    // robot, que está en y>0). NO es sólido (es aire) → solids vacío.
    if (hole) {
      const W = DOOR.POST_W, z1 = aabb.z1 - DOOR.LINTEL_H;
      const vh = axis === "x" ? { ...aabb, x0: aabb.x0 + W, x1: aabb.x1 - W, z1 }
                              : { ...aabb, y0: aabb.y0 + W, y1: aabb.y1 - W, z1 };
      t.push({ ...base, half: "hole", aabb: vh, solids: [] });
    }
  };
  // borde y=0 (atrás-dcha, eje x): pared partida por su vano + puerta de fondo ym
  const sy = exits.ym ? doorSpan(w) : null;
  for (const [c0, c1] of wallSegs(w, sy)) if (c1 > c0) wall("x", 0, c0, c1);
  if (sy) door("x", 0, sy[0], sy[1], -1, true);
  // borde x=0 (atrás-izq, eje y): pared partida + puerta de fondo xm
  const sx = exits.xm ? doorSpan(h) : null;
  for (const [c0, c1] of wallSegs(h, sx)) if (c1 > c0) wall("y", 0, c0, c1);
  if (sx) door("y", 0, sx[0], sx[1], -1, true);
  // bordes FRONTALES abiertos (sin muro): solo el marco de puerta protruido (yp eje x en y=h; xp eje y en x=w)
  if (exits.yp) { const [s0, s1] = doorSpan(w); door("x", h, s0, s1, +1, false); }
  if (exits.xp) { const [s0, s1] = doorSpan(h); door("y", w, s0, s1, +1, false); }
  _shellCache.set(room, t);
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

  const start = MISSION.start.room;   // sala inicial: la decide la misión (data/mission.js)
  (function layout() {
    rooms[start].wx = 0; rooms[start].wy = 0;
    const seen = new Set([start]), q = [start];
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

  return { rooms, start };
}
