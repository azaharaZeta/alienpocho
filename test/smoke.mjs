/* =============================================================================
   ALIEN POCHO — SMOKE TESTS (test/smoke.mjs)
   -----------------------------------------------------------------------------
   Oráculo de NO-REGRESIÓN para el refactor: ejercita la lógica pura (sin DOM) de
   mundo, painter y física a través de los módulos ES. No dibuja nada.
   Ejecutar:  node test/smoke.mjs   (o  npm test)

   Posible porque view.js/input.js DIFIEREN el acceso al DOM a sus init(): importar
   game.js en Node no toca `window`/`document`.
   ============================================================================= */
import assert from "node:assert/strict";

import { ENGINE } from "../src/engine.js";
import { buildWorld } from "../src/world.js";
import { START } from "../src/data/rooms.js";
import {
  game, player, room, interact, checkExits, resetGame, updateObjects,
  blocksHoriz, supportHeight
} from "../src/game.js";

/* ---- mini-runner sin dependencias ---- */
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}

const OPP = { xp: "xm", xm: "xp", yp: "ym", ym: "yp" };

console.log("ALIEN POCHO — smoke tests\n");

/* ----------------------------------------------------------------- MUNDO --- */
test("buildWorld arma 8 salas con la inicial presente", () => {
  const w = buildWorld();
  assert.equal(Object.keys(w.rooms).length, 8);
  assert.ok(w.rooms[START], "existe la sala inicial");
  assert.equal(w.start, START);
});

test("cada salida tiene su recíproca en la sala destino", () => {
  const w = buildWorld();
  for (const [key, r] of Object.entries(w.rooms)) {
    for (const [dir, target] of Object.entries(r.exits)) {
      const t = w.rooms[target];
      assert.ok(t, `la sala destino ${target} (desde ${key}.${dir}) existe`);
      assert.equal(t.exits[OPP[dir]], key, `recíproca ${target}.${OPP[dir]} apunta a ${key}`);
    }
  }
});

test("el layout asigna (wx,wy) a todas las salas (mundo conexo)", () => {
  const w = buildWorld();
  for (const [key, r] of Object.entries(w.rooms))
    assert.notEqual(r.wx, undefined, `la sala ${key} tiene posición de mundo`);
});

test("makeRoom respeta los límites de tamaño (w,h ∈ [3,13], w+h ≤ 16)", () => {
  const w = buildWorld();
  for (const [key, r] of Object.entries(w.rooms)) {
    assert.ok(r.w >= 3 && r.w <= 13, `${key} ancho en rango`);
    assert.ok(r.h >= 3 && r.h <= 13, `${key} alto en rango`);
    assert.ok(r.w + r.h <= 16, `${key} cabe en pantalla`);
  }
});

/* --------------------------------------------------------------- PAINTER --- */
test("depthSort: la caja de detrás se pinta primero y no pierde cajas", () => {
  const p = ENGINE.projector(0, 0, { TILE_W: 34, TILE_H: 17, BLOCK_H: 17 });
  const A = { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1, tag: "A" };  // detrás (menos x+y)
  const B = { x0: 1, y0: 1, z0: 0, x1: 2, y1: 2, z1: 1, tag: "B" };  // delante
  const out = ENGINE.depthSort([B, A], p);   // entra desordenada
  assert.equal(out.length, 2, "no se pierde ninguna caja");
  assert.equal(out[0].tag, "A", "A (detrás) se pinta antes");
  assert.equal(out[1].tag, "B", "B (delante) se pinta después");
});

/* ---------------------------------------------------------------- FÍSICA --- */
test("colisión: se choca con un bloque y se anda por celda libre", () => {
  const r = buildWorld().rooms["0,0"];        // ENTRADA, bloque en (2,2)
  assert.equal(blocksHoriz(r, 2.5, 2.5, 0), true, "la celda del bloque bloquea");
  assert.equal(blocksHoriz(r, 0.5, 0.5, 0), false, "una celda libre no bloquea");
});

test("apoyo: el suelo es 0 y la cima de un bloque es su altura", () => {
  const r = buildWorld().rooms["0,0"];
  assert.equal(supportHeight(r, 0.5, 0.5, 0), 0, "suelo a z=0");
  assert.equal(supportHeight(r, 2.5, 2.5, 1), 1, "cima del bloque de 1 capa = 1");
});

/* ------------------------------------------------- TRANSICIÓN ENTRE SALAS --- */
test("checkExits: cruzar el borde con salida cambia de sala (flip-screen)", () => {
  resetGame();
  assert.equal(room.name, "ENTRADA");
  player.x = room.w + 0.1;                     // pasa el borde +x (exit xp → GALERIA)
  checkExits();
  assert.equal(room.name, "GALERIA", "aparece en la sala vecina");
  assert.equal(player.x, 0.2, "reaparece pegado al borde opuesto");
});

/* --------------------------------------------- OBJETOS: COGER + ACTIVAR -------- */
test("coger un circuito lo retira de la sala y lo pone en la mano", () => {
  resetGame();
  const entrada = room;
  assert.equal(entrada.objects.length, 1, "ENTRADA arranca con 1 objeto");
  player.x = 3.5; player.y = 5.5; player.z = 0; game.carried = null;
  interact(entrada);
  assert.equal(game.carried, "cube", "lleva el cubo");
  assert.equal(entrada.objects.length, 0, "el objeto ya no está suelto en la sala");
});

test("colocar la forma correcta en su zócalo lo activa y suma circuito", () => {
  resetGame();
  const entrada = room;
  player.x = 6.5; player.y = 5.5; player.z = 0; game.carried = "cube";   // casilla del zócalo cube
  const before = game.circuits;
  interact(entrada);
  assert.equal(game.carried, null, "el circuito se coloca");
  assert.equal(entrada.sockets[0].active, true, "el zócalo queda activado");
  assert.equal(game.circuits, before + 1, "el contador de circuitos sube");
});

test("colocar el último circuito gana la partida", () => {
  resetGame();
  game.circuits = game.circuitsTotal - 1;      // a falta de uno
  player.x = 6.5; player.y = 5.5; player.z = 0; game.carried = "cube";
  interact(room);
  assert.equal(game.won, true, "game.won al completar todos");
});

/* ---------------------------------------------- GRAVEDAD DE OBJETOS -------- */
test("un objeto en el aire cae hasta su apoyo", () => {
  resetGame();
  const o = room.objects[0];                   // cubo de ENTRADA, sin bloque debajo
  o.z = 2; o.vz = 0;
  for (let i = 0; i < 240; i++) updateObjects(room, 1 / 60);
  assert.ok(o.z <= 1e-3, "termina en el suelo (z≈0)");
});

/* ----------------------------------- RESET: SIN FUGA DE ESTADO ENTRE PARTIDAS -- */
test("resetGame reconstruye el mundo sin arrastrar estado mutado", () => {
  // ensucia el estado
  resetGame();
  player.x = 6.5; player.y = 5.5; player.z = 0; game.carried = "cube";
  interact(room);                              // activa zócalo, retira objeto, circuits++
  // reinicia
  resetGame();
  assert.equal(game.circuits, 0, "circuitos a 0");
  assert.equal(game.carried, null, "manos vacías");
  assert.equal(game.won, false, "no ganado");
  assert.equal(room.name, "ENTRADA", "vuelve a la entrada");
  assert.equal(player.x, 1.5); assert.equal(player.y, 6.5);
  assert.equal(room.objects.length, 1, "el objeto de ENTRADA vuelve a estar (clones frescos)");
  assert.equal(room.sockets[0].active, false, "el zócalo vuelve a estar inactivo");
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
