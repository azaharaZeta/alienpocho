/* =============================================================================
   ALIEN POCHO — FÍSICA (physics.js)
   -----------------------------------------------------------------------------
   Geometría y colisión PURAS de la sala: límites/puertas, cajas sólidas, apoyo,
   colisión horizontal, sitio para ponerse de pie, empuje/caída de objetos.
   Todas operan sobre (room, x, y, …): NO conocen al jugador (eso vive en player.js),
   así que esto es reutilizable por cualquier entidad. Fuente ÚNICA de sólidos
   (roomSolids) → física y render nunca se contradicen.
   ============================================================================= */
"use strict";

import { CFG, PROP, ROBOT, SOCKET, DOOR } from "./config.js";

/* ¿Está la coord. dentro del HUECO de la puerta? Vano estrecho: el robot (semiancho
   ~0.5) pasa con un poco de margen. Coincide con el hueco visual entre postes. */
const DOOR_HALF = DOOR.SPAN_HALF - DOOR.POST_W;   // hueco passable = vano − postes (≈ 0.72)
function inDoor(coord, n) { return Math.abs(coord - n / 2) <= DOOR_HALF; }

/* ¿Cae fuera del suelo? Solo se puede cruzar un borde si tiene salida Y por el
   HUECO de su puerta; el resto del borde es pared sólida (no se atraviesa). */
export function outOfBounds(room, fx, fy) {
  if (fx < 0)        return !(room.exits.xm && inDoor(fy, room.h));
  if (fx >= room.w)  return !(room.exits.xp && inDoor(fy, room.h));
  if (fy < 0)        return !(room.exits.ym && inDoor(fx, room.w));
  if (fy >= room.h)  return !(room.exits.yp && inDoor(fx, room.w));
  return false;
}

/* Caja física de un OBJETO transportable, centrada en su celda. Misma geometría
   para colisión, apoyo, empuje y dibujo (AP.prop) → nunca se solapa con el robot. */
export function objBox(o) {
  const m = PROP.HALF;   // o.x,o.y = CENTRO continuo (igual convención que el jugador)
  return { x0: o.x - m, y0: o.y - m, x1: o.x + m, y1: o.y + m, z0: o.z, top: o.z + PROP.H, obj: o };
}

/* CAJAS SÓLIDAS de la sala — fuente ÚNICA para colisión y apoyo. Cada sólido es
   una huella en planta [x0,y0]-[x1,y1] con base `z0` y cima `top`:
     - bloques: cubo completo (una caja por bloque, aunque tenga varias capas);
     - objetos: cajas transportables (se empujan, se sube uno encima y se apilan).
   Los ZÓCALOS NO son sólidos: son la casilla-DESTINO sobre la que el robot se planta
   para soltar el circuito y activarlos (ver interact). Los PINCHOS tampoco (se saltan;
   el daño llega en Fase 6). */
/* Cima SÓLIDA de un zócalo según su estado: la peana (SOCKET.BASE_H) y, si está ACTIVADO, el
   circuito encajado encima (PROP.H). El zócalo es SÓLIDO siempre: inactivo = peana baja a la que
   el robot SE SUBE andando (mientras SOCKET.BASE_H ≤ CFG.STEP); activo = peana + circuito. */
export function socketTop(s) { return (s.z || 0) + SOCKET.BASE_H + (s.active ? PROP.H : 0); }

export function roomSolids(room) {
  const s = [];
  for (const bl of room.blocks)
    s.push({ x0: bl.x, y0: bl.y, z0: bl.z, x1: bl.x + 1, y1: bl.y + 1, top: bl.z + bl.h });
  for (const o of room.objects) s.push(objBox(o));
  // Los zócalos son SÓLIDOS (sin excepciones): el inactivo es una peana baja a la que el robot SE
  // SUBE andando (SOCKET.BASE_H ≤ CFG.STEP); el activo suma el circuito encajado encima. Misma
  // huella que su dibujo (AP.socket) → física y render no se contradicen.
  for (const k of room.sockets) {
    const oz = k.z || 0;
    s.push({ x0: k.cx + 0.16, y0: k.cy + 0.16, z0: oz, x1: k.cx + 0.84, y1: k.cy + 0.84, top: socketTop(k) });
  }
  return s;
}

/* Solape de la caja del jugador (en planta) con la huella de un sólido */
export function overlapsBox(b, x, y) {
  const r = CFG.PRAD;
  return (x - r) < b.x1 && (x + r) > b.x0 &&
         (y - r) < b.y1 && (y + r) > b.y0;
}

/* ¿El movimiento horizontal a (nx,ny) choca, con los pies a feetZ?
   Un sólido solo bloquea si su cima queda POR ENCIMA del pie (no se sube
   andando: hay que SALTAR). Sólidos al nivel del pie o por debajo son
   pisables/transitables. */
export function blocksHoriz(room, nx, ny, feetZ) {
  const r = CFG.PRAD;
  if (outOfBounds(room, nx - r, ny - r) || outOfBounds(room, nx + r, ny - r) ||
      outOfBounds(room, nx - r, ny + r) || outOfBounds(room, nx + r, ny + r)) return true;
  for (const b of roomSolids(room))
    if (b.top > feetZ + CFG.STEP && overlapsBox(b, nx, ny)) return true;
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

/* ¿Cabe el robot DE PIE con los pies a feetZ en (x,y)? (límites + que ningún sólido
   invada el volumen del cuerpo por encima de los pies). Se usa para decidir si se
   puede soltar un objeto bajo el robot y subirse encima. */
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

/* ¿Puede el objeto `obj` ocupar el centro (nx,ny) a su altura actual? No si se
   sale de la sala o si pisa otro sólido (bloque/objeto/zócalo) cuya cima quede por
   encima de su base. Empuje en PLANO: no se empuja un objeto hacia arriba. */
export function objBlocked(room, obj, nx, ny) {
  const m = PROP.HALF;
  // Los objetos NO cruzan puertas (solo el robot): chocan con TODO el borde de la sala.
  if (nx - m < 0 || nx + m > room.w || ny - m < 0 || ny + m > room.h) return true;
  for (const b of roomSolids(room)) {
    if (b.obj === obj) continue;
    const ov = (nx - m) < b.x1 && (nx + m) > b.x0 && (ny - m) < b.y1 && (ny + m) > b.y0;
    if (ov && b.top > obj.z + 0.01) return true;
  }
  return false;
}

/* Superficie de apoyo bajo un objeto (cima del sólido más alto que pisa, sin contarse a
   sí mismo); el suelo (0) si no hay nada. Sirve para que los objetos CAIGAN. */
export function objSupport(room, o) {
  const m = PROP.HALF; let h = 0;
  for (const b of roomSolids(room)) {
    if (b.obj === o) continue;
    const ov = (o.x - m) < b.x1 && (o.x + m) > b.x0 && (o.y - m) < b.y1 && (o.y + m) > b.y0;
    if (ov && b.top <= o.z + 0.02 && b.top > h) h = b.top;
  }
  return h;
}

/* Gravedad de los OBJETOS: si quedan en el aire (p. ej. tras empujarlos fuera de una
   plataforma), caen hasta su superficie de apoyo. Se llama una vez por frame. */
export function updateObjects(room, dt) {
  for (const o of room.objects) {
    const s = objSupport(room, o);
    if (o.z > s + 1e-3 || o.vz) {
      o.vz = (o.vz || 0) - CFG.GRAVITY * dt;
      o.z += o.vz * dt;
      if (o.z <= s) { o.z = s; o.vz = 0; }
    }
  }
}
