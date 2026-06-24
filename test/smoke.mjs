/* =============================================================================
   ALIEN POCHO — SMOKE TESTS (test/smoke.mjs)
   -----------------------------------------------------------------------------
   Oráculo de NO-REGRESIÓN: ejercita la lógica pura (sin DOM) de mundo, painter y
   física a través de los módulos ES. No dibuja nada.
   Ejecutar:  node test/smoke.mjs   (o  npm test)

   Posible porque view.js/input.js DIFIEREN el acceso al DOM a sus init(): importar
   game.js en Node no toca `window`/`document`.
   ============================================================================= */
import assert from "node:assert/strict";

import { ENGINE } from "../src/engine.js";
import { buildWorld, roomThings } from "../src/world.js";
import { START } from "../src/data/rooms.js";
import { game, room, interact, checkExits, resetGame } from "../src/game.js";
import { player } from "../src/player.js";
import { updateObjects, blocksHoriz, supportHeight, roomSolids, socketTop } from "../src/physics.js";
import { CFG, SOCKET } from "../src/config.js";
import { ASSETS, assetHas } from "../src/data/assets.js";

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

test("roomThings: lista uniforme coherente y SÓLIDOS equivalentes a roomSolids (por columna)", () => {
  const w = buildWorld();
  for (const [key, room] of Object.entries(w.rooms)) {
    const things = roomThings(room);
    // 1) cada placement referencia un asset válido y trae aabb bien formada
    for (const t of things) {
      assert.ok(ASSETS[t.asset], `${key}: asset desconocido ${t.asset}`);
      assert.ok(t.aabb && t.aabb.z1 >= t.aabb.z0, `${key}: aabb inválida en ${t.asset}`);
    }
    // 2) la UNIÓN de las cajas sólidas cubre lo mismo que roomSolids: misma cima por celda-base
    const topByCell = (boxes) => {
      const m = new Map();
      for (const b of boxes) {
        const x0 = b.x0 ?? b.aabb.x0, y0 = b.y0 ?? b.aabb.y0, top = b.top ?? b.aabb.z1;
        const k = Math.round(x0 * 100) + "," + Math.round(y0 * 100);
        m.set(k, Math.max(m.get(k) ?? -1e9, top));
      }
      return m;
    };
    const a = topByCell(roomSolids(room));
    const b = topByCell(things.filter(t => assetHas(t.asset, "solid")));
    assert.deepEqual([...b.entries()].sort(), [...a.entries()].sort(),
      `${key}: la cima sólida por celda difiere entre roomThings y roomSolids`);
  }
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

test("STEP permite subir a superficies bajas (peana del zócalo ≤ STEP)", () => {
  assert.ok(SOCKET.BASE_H <= CFG.STEP, `la peana del zócalo (${SOCKET.BASE_H}) debe ser subible andando (STEP=${CFG.STEP})`);
});

test("el zócalo es SÓLIDO (no atravesable) y el robot SE SUBE a su peana andando", () => {
  const r = buildWorld().rooms["0,0"];        // ENTRADA, zócalo inactivo en celda (6,5)
  const sock = r.sockets[0];
  // 1) es sólido: aparece en roomSolids con la altura de su peana
  const solid = roomSolids(r).find(b => b.x0 > 6 && b.x0 < 7 && b.y0 > 5 && b.y0 < 6);
  assert.ok(solid, "el zócalo inactivo está entre los sólidos (no es atravesable)");
  assert.equal(solid.top, socketTop(sock), "su cima sólida = peana (socketTop)");
  // 2) NO bloquea el avance (es bajo): el robot entra en su celda andando…
  assert.equal(blocksHoriz(r, 6.5, 5.5, 0), false, "la peana baja no bloquea (se sube andando)");
  // 3) …y queda apoyado ENCIMA de la peana, no a z=0
  assert.equal(supportHeight(r, 6.5, 5.5, 0), SOCKET.BASE_H, "el robot se apoya sobre la peana");
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
  assert.equal(entrada.objects.length, 2, "ENTRADA arranca con 2 (bloque + circuito, cubeta única)");
  player.x = 3.5; player.y = 5.5; player.z = 0; game.carried = null;
  interact(entrada);
  assert.equal(game.carried, "cube", "lleva el cubo");
  assert.equal(entrada.objects.length, 1, "el circuito ya no está suelto (queda el bloque)");
});

test("colocar la forma correcta en su zócalo lo activa y suma circuito", () => {
  resetGame();
  const entrada = room;
  player.x = 6.5; player.y = 5.5; player.z = 0; game.carried = "cube";   // casilla del zócalo cube
  const before = game.circuits;
  interact(entrada);
  assert.equal(game.carried, null, "el circuito se coloca");
  assert.equal(entrada.sockets[0].filled, "cube", "el zócalo queda con el circuito puesto");
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
  const o = room.objects.find(e => e.shape);   // el circuito de ENTRADA (cae); el bloque no tiene `falls`
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
  assert.equal(room.objects.length, 2, "los objetos de ENTRADA vuelven (bloque + circuito, clones frescos)");
  assert.equal(room.sockets[0].filled, null, "el zócalo vuelve a estar vacío");
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
