/* =============================================================================
   ALIEN POCHO — FÍSICA (physics.js)
   -----------------------------------------------------------------------------
   Geometría y colisión PURAS de la sala: límites/puertas, cajas sólidas, apoyo,
   colisión horizontal, sitio para ponerse de pie, empuje/caída de objetos.
   Operan sobre (room, x, y, …): no conocen al jugador → reutilizable por cualquier
   entidad. Fuente única de sólidos (roomSolids), compartida con render.
   ============================================================================= */
"use strict";

import { CFG, ROBOT, DOOR } from "./config.js";
import { assetHas, assetFoot, socketTop } from "./data/assets.js";   // traits + huella + cima del zócalo
import { roomThings, roomShell, objAsset, thingHas } from "./world.js";   // placements uniformes (objetos + cáscara) + asset/traits
export { socketTop, objAsset, thingHas };

// Semilado / alto de un MÓVIL según la huella de su asset (siempre definida: objAsset da un id válido).
const objHalf = o => assetFoot(objAsset(o)).w / 2;
const objTopH = o => assetFoot(objAsset(o)).h;

/* ¿Está la coord. dentro del HUECO de la puerta? Coincide con el hueco visual entre postes. */
const DOOR_HALF = DOOR.SPAN_HALF - DOOR.POST_W;   // semiancho passable del vano = vano − postes (= 0.60)
function inDoor(coord, n) { return Math.abs(coord - n / 2) <= DOOR_HALF; }

/* ¿Sale del MUNDO? El borde de la sala es un límite DURO en las 4 paredes y a CUALQUIER altura: solo se cruza
   por el hueco de su puerta (si esa salida existe). Esto es independiente de los sólidos de pared (roomShell):
   esos tienen altura finita, así que subido a un mueble alto se podía SALTAR el muro de fondo y salirse de la
   sala — por eso el borde del mundo se comprueba aquí por coordenada (alto infinito), en los 4 lados por igual.
   (Las paredes/postes siguen siendo sólidos para apoyarse/chocar a ras de suelo; esto es el techo del mundo.) */
export function outOfBounds(room, fx, fy) {
  if (fx >= room.w)  return !(room.exits.xp && inDoor(fy, room.h));
  if (fx < 0)        return !(room.exits.xm && inDoor(fy, room.h));
  if (fy >= room.h)  return !(room.exits.yp && inDoor(fx, room.w));
  if (fy < 0)        return !(room.exits.ym && inDoor(fx, room.w));
  return false;
}

/* Caja física de un MÓVIL, centrada en su celda, con la huella del asset. Misma geometría
   para colisión, apoyo, empuje y dibujo. o.x,o.y = centro continuo (como el jugador). */
export function objBox(o) {
  const m = objHalf(o);
  return { x0: o.x - m, y0: o.y - m, x1: o.x + m, y1: o.y + m, z0: o.z, top: o.z + objTopH(o), obj: o };
}

/* CAJAS SÓLIDAS de la sala — FUENTE ÚNICA para colisión y apoyo, compartida con render. Une dos listas
   uniformes con el MISMO formato de placement: los `objects` con trait `solid` (roomThings) y la CÁSCARA
   estructural (roomShell): las paredes aportan su caja, las puertas sus dos POSTES (campo `solids`, dejando
   libre el vano). Así paredes, puertas y bloques se colisionan EXACTAMENTE igual (AABB). La cima (zócalo
   activo, ya con el circuito) la trae el placement. `obj` = fuente (para no chocar consigo en el empuje).
   Se RECALCULA en cada llamada A PROPÓSITO (no cachear): los objetos son MUTABLES (empuje/gravedad/colocar)
   → "siempre fresco" evita un caché con invalidación frágil; la parte INMUTABLE (la cáscara) ya la cachea
   world.js (roomShell). Las salas son pequeñas, así que el recálculo es ruido. */
export function roomSolids(room) {
  const s = [], add = (a, obj) => s.push({ x0: a.x0, y0: a.y0, z0: a.z0, x1: a.x1, y1: a.y1, top: a.z1, obj });
  for (const t of roomThings(room)) if (assetHas(t.asset, "solid")) add(t.aabb, t.src);
  for (const t of roomShell(room)) for (const b of (t.solids || [t.aabb])) add(b, t.src);   // pared: su caja; puerta: postes
  return s;
}

/* Solape de la caja del jugador (en planta) con la huella de un sólido */
export function overlapsBox(b, x, y) {
  const r = CFG.PRAD;
  return (x - r) < b.x1 && (x + r) > b.x0 &&
         (y - r) < b.y1 && (y + r) > b.y0;
}

/* ¿El movimiento horizontal a (nx,ny) choca, con los pies a feetZ?
   Un sólido solo bloquea si su cima queda por encima del pie (no se sube andando: hay que saltar) Y su
   base queda por debajo de la cabeza (si está más arriba — p. ej. el DINTEL de una puerta — se pasa por
   debajo). Al nivel del pie o por debajo es pisable/transitable. */
export function blocksHoriz(room, nx, ny, feetZ) {
  const r = CFG.PRAD;
  if (outOfBounds(room, nx - r, ny - r) || outOfBounds(room, nx + r, ny - r) ||
      outOfBounds(room, nx - r, ny + r) || outOfBounds(room, nx + r, ny + r)) return true;
  for (const b of roomSolids(room))
    if (b.top > feetZ + CFG.STEP && b.z0 < feetZ + ROBOT.H && overlapsBox(b, nx, ny)) return true;
  return false;
}

/* Altura de la superficie de apoyo bajo el jugador: el suelo (0) o la cima
   del sólido más alto que esté a la altura del pie o por debajo. */
export function supportHeight(room, x, y, feetZ) {
  let h = 0;
  for (const b of roomSolids(room))
    if (b.top <= feetZ + CFG.STEP && b.top > h && overlapsBox(b, x, y)) h = b.top;
  return h;
}

/* Altura de TECHO sobre la cabeza del robot en (x,y): la base (z0) del sólido más bajo que quede por
   ENCIMA de la cabeza actual y solape en planta (p. ej. el DINTEL de una puerta). Infinity = cielo libre.
   Simétrico de supportHeight (suelo bajo los pies): acota cuánto puede SUBIR la cabeza en un salto. */
export function ceilingHeight(room, x, y, feetZ) {
  const headZ = feetZ + ROBOT.H; let c = Infinity;
  for (const b of roomSolids(room))
    if (b.z0 >= headZ - 0.05 && b.z0 < c && overlapsBox(b, x, y)) c = b.z0;
  return c;
}

/* ¿Cabe el robot DE PIE con los pies a feetZ en (x,y)? (límites + que ningún sólido
   invada el volumen del cuerpo por encima de los pies). Decide si se puede soltar un
   objeto bajo el robot y subirse encima. */
export function canStandOn(room, x, y, feetZ) {
  const m = CFG.PRAD, headZ = feetZ + ROBOT.H;
  if (outOfBounds(room, x - m, y - m) || outOfBounds(room, x + m, y - m) ||
      outOfBounds(room, x - m, y + m) || outOfBounds(room, x + m, y + m)) return false;
  for (const b of roomSolids(room)) {
    const ov = (x - m) < b.x1 && (x + m) > b.x0 && (y - m) < b.y1 && (y + m) > b.y0;
    if (ov && b.top > feetZ + 0.05 && b.z0 < headZ - 0.05) return false;  // algo estorba arriba
  }
  return true;
}

/* ¿Puede el objeto `obj` ocupar el centro (nx,ny) a su altura actual? No si se sale de
   la sala o si pisa otro sólido cuya cima quede por encima de su base. Empuje en plano. */
export function objBlocked(room, obj, nx, ny, exclude) {
  const m = objHalf(obj);
  // Los objetos NO cruzan puertas (solo el robot): chocan con TODO el borde de la sala.
  if (nx - m < 0 || nx + m > room.w || ny - m < 0 || ny + m > room.h) return true;
  for (const b of roomSolids(room)) {
    if (b.obj === obj || (exclude && exclude.has(b.obj))) continue;   // ignora el propio objeto y su PILA (riders que viajan con él)
    const ov = (nx - m) < b.x1 && (nx + m) > b.x0 && (ny - m) < b.y1 && (ny + m) > b.y0;
    if (ov && b.top > obj.z + 0.01) return true;
  }
  return false;
}

/* Área de solape (en planta) de la huella del objeto en (x,y) con un sólido `b`. 0 si no se tocan. */
function objOverlapArea(obj, x, y, b) {
  const m = objHalf(obj);
  const ox = Math.min(x + m, b.x1) - Math.max(x - m, b.x0);
  const oy = Math.min(y + m, b.y1) - Math.max(y - m, b.y0);
  return (ox > 0 && oy > 0) ? ox * oy : 0;
}

/* ¿Bloquea EMPUJAR el objeto de su sitio actual a (nx,ny)? Como `objBlocked`, pero TOLERANTE a salir de un
   solape ya existente: un paso solo se bloquea si AUMENTA la penetración con un sólido (área de solape).
   Así no se puede hundir más en un sólido (ni cruzarlo), pero un objeto que quedó pegado/solapado SIEMPRE
   puede deslizar a lo largo del contacto o salir — nunca se queda atrapado. (`objBlocked`, estricto, se
   reserva para SOLTAR, donde sí debe rechazar todo solape.) `exclude` = la pila que viaja con él. */
export function pushBlocked(room, obj, nx, ny, exclude) {
  const m = objHalf(obj);
  if (nx - m < 0 || nx + m > room.w || ny - m < 0 || ny + m > room.h) return true;   // borde del mundo
  for (const b of roomSolids(room)) {
    if (b.obj === obj || (exclude && exclude.has(b.obj))) continue;
    if (b.top <= obj.z + 0.01) continue;                          // pisable: no estorba al empuje
    if (objOverlapArea(obj, nx, ny, b) > objOverlapArea(obj, obj.x, obj.y, b) + 1e-6) return true;   // aumenta penetración → no
  }
  return false;
}

/* Objetos que VIAJAN encima de `base` (transitivo): los que descansan sobre su cima, y los que descansan
   sobre esos, etc. Al empujar una mesa con un monitor encima, el monitor (y lo que tenga encima) va con ella.
   "Descansar sobre" = solapa en planta Y su base está a la cima del de abajo. */
export function ridersOf(room, base) {
  const riders = [], seen = new Set([base]), stack = [base];
  while (stack.length) {
    const b = stack.pop(), bTop = b.z + objTopH(b), mb = objHalf(b);
    for (const o of room.objects) {
      if (seen.has(o)) continue;
      const mo = objHalf(o);
      const ov = (o.x - mo) < (b.x + mb) && (o.x + mo) > (b.x - mb) && (o.y - mo) < (b.y + mb) && (o.y + mo) > (b.y - mb);
      if (ov && Math.abs(o.z - bTop) < 0.05) { seen.add(o); riders.push(o); stack.push(o); }
    }
  }
  return riders;
}

/* Superficie de apoyo bajo un objeto (cima del sólido más alto que pisa, sin contarse a
   sí mismo); el suelo (0) si no hay nada. */
export function objSupport(room, o) {
  const m = objHalf(o); let h = 0;
  for (const b of roomSolids(room)) {
    if (b.obj === o) continue;
    const ov = (o.x - m) < b.x1 && (o.x + m) > b.x0 && (o.y - m) < b.y1 && (o.y + m) > b.y0;
    if (ov && b.top <= o.z + 0.02 && b.top > h) h = b.top;
  }
  return h;
}

/* Gravedad de los OBJETOS: si quedan en el aire, caen hasta su superficie de apoyo.
   Se llama una vez por frame. */
export function updateObjects(room, dt) {
  for (const o of room.objects) {
    if (!thingHas(o, "falls")) continue;   // solo caen los que tienen el trait `falls` (asset o instancia)
    const s = objSupport(room, o);
    if (o.z > s + 1e-3 || o.vz) {
      o.vz = (o.vz || 0) - CFG.GRAVITY * dt;
      o.z += o.vz * dt;
      if (o.z <= s) { o.z = s; o.vz = 0; }
    }
  }
}
