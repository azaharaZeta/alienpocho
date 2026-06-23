/* =============================================================================
   ALIEN POCHO — ESTADO + REGLAS (game.js)
   -----------------------------------------------------------------------------
   Estado `game`, interacción con circuitos (coger/soltar/activar zócalo +
   condición de victoria), instancia del mundo, transiciones flip-screen entre
   salas (checkExits) y reinicio (resetGame).

   La física vive en physics.js, la entidad jugador en player.js, los datos del mapa
   en data/rooms.js (los arma world.js). Aquí se orquesta el estado.
   ============================================================================= */
"use strict";

import { CFG, PROP } from "./config.js";
import { canStandOn, socketTop, overlapsBox, objBox } from "./physics.js";
import { player } from "./player.js";
import { buildWorld, roomThings } from "./world.js";
import { assetHas } from "./data/assets.js";   // traits del asset (receptacle/carriable)

/* Estado de partida. */
export const game = { state: "title", lives: 3, circuits: 0, circuitsTotal: 4, carried: null, lightYears: 9999, won: false };

/* interact() — interacción vertical con los objetos:
   - LLEVANDO algo: si estás sobre el destino de un zócalo compatible, lo colocas y se
     activa. Si no, sueltas el objeto bajo tus pies y te subes encima, solo si hay hueco.
   - MANOS LIBRES: coges el objeto sobre el que estás subido o pegado; subido → caes a su sitio. */
export function interact(room) {
  if (game.won) return;
  const things = roomThings(room);   // lista uniforme; se filtra por comportamiento (trait)

  if (game.carried) {
    // 1) ¿plantado sobre un destino compatible y libre? → colocar y activar
    for (const t of things) {
      if (!assetHas(t.asset, "receptacle")) continue;
      const s = t.src;
      if (!s.active && t.shape === game.carried &&
          Math.abs(player.x - t.x) < 0.5 && Math.abs(player.y - t.y) < 0.5 &&
          Math.abs(player.z - t.z) < 0.4) {
        s.active = true; game.carried = null; game.circuits++;
        if (game.circuits >= game.circuitsTotal) game.won = true;
        player.z = socketTop(s); player.vz = 0; player.onGround = true;   // s.active ya true → cima activa
        return;
      }
    }
    // 2) soltar bajo los pies y subirse encima — solo si hay sitio arriba
    if (player.onGround && canStandOn(room, player.x, player.y, player.z + PROP.H)) {
      room.objects.push({ x: player.x, y: player.y, z: player.z, shape: game.carried });
      game.carried = null;
      player.z += PROP.H;                 // subir encima
      player.vz = 0; player.onGround = true;
    }
    return;                                  // sin hueco → no suelta
  }

  // Manos libres: coger un carriable si estás subido encima (huella lo pisa y pies a su
  // cima) o pegado a él (misma altura base y huellas casi tocándose).
  const REACH = 0.2;   // margen de alcance lateral para "pegado"
  for (const t of things) {
    if (!assetHas(t.asset, "carriable")) continue;
    const o = t.src, b = objBox(o);
    const encima = overlapsBox(b, player.x, player.y) && Math.abs((o.z + PROP.H) - player.z) < 0.25;
    const pegado = Math.abs(player.z - o.z) < 0.4 &&
      (player.x - CFG.PRAD - REACH) < b.x1 && (player.x + CFG.PRAD + REACH) > b.x0 &&
      (player.y - CFG.PRAD - REACH) < b.y1 && (player.y + CFG.PRAD + REACH) > b.y0;
    if (encima || pegado) {
      game.carried = o.shape;
      const i = room.objects.indexOf(o); if (i >= 0) room.objects.splice(i, 1);
      if (encima) { player.onGround = false; player.vz = 0; }  // que se vea caer hasta o.z
      return;
    }
  }
}

/* =========================================================================
   WORLD INSTANCE + transiciones entre salas
   ========================================================================= */
export const world = buildWorld();
export let room = world.rooms[world.start];

/* Transición flip-screen: al cruzar un borde con salida, cambia de sala y reaparece
   por el borde opuesto, recentrando la coordenada perpendicular en la puerta destino.
   Funciona aunque las salas tengan tamaños distintos. */
export function checkExits() {
  const e = room.exits;
  let key = null, R = null;
  if (player.x >= room.w && e.xp)      { key = e.xp; R = world.rooms[key]; player.x = 0.2;        player.y = R.h / 2; }
  else if (player.x < 0 && e.xm)       { key = e.xm; R = world.rooms[key]; player.x = R.w - 0.2;  player.y = R.h / 2; }
  else if (player.y >= room.h && e.yp) { key = e.yp; R = world.rooms[key]; player.y = 0.2;        player.x = R.w / 2; }
  else if (player.y < 0 && e.ym)       { key = e.ym; R = world.rooms[key]; player.y = R.h - 0.2;  player.x = R.w / 2; }
  if (key) {
    room = world.rooms[key];
    player.z = 0; player.vz = 0; player.vx = 0; player.vy = 0;
    player.onGround = true; player.jumpPending = false;
  }
}

/* Reinicia la partida desde cero (tras victoria; también para game over). */
export function resetGame() {
  const fresh = buildWorld();
  world.rooms = fresh.rooms;                 // salas nuevas (estado de objetos limpio)
  room = world.rooms[world.start];
  Object.assign(player, {
    x: 1.5, y: 6.5, z: 0, vz: 0, vx: 0, vy: 0, onGround: true,
    facing: 3, turnTimer: 0, walkPhase: 0, moving: false,
    jumpPending: false, jumpPendTime: 0, jdx: 0, jdy: 0
  });
  game.lives = 3; game.circuits = 0; game.carried = null;
  game.lightYears = 9999; game.won = false;
}
