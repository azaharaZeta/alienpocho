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
import { ROOMS } from "../src/data/rooms.js";
import { buildWorld, roomThings, roomShell } from "../src/world.js";
import { MISSION } from "../src/data/mission.js";
import { game, room, interact, checkExits, resetGame } from "../src/game.js";
import { player } from "../src/player.js";
import { updateObjects, blocksHoriz, supportHeight, roomSolids, socketTop } from "../src/physics.js";
import { CFG, SOCKET, DOOR, WALL_TILE } from "../src/config.js";
import { ASSETS, assetHas, WALL_H } from "../src/data/assets.js";

/* ---- mini-runner sin dependencias ---- */
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}

const OPP = { xp: "xm", xm: "xp", yp: "ym", ym: "yp" };

console.log("ALIEN POCHO — smoke tests\n");

/* ----------------------------------------------------------------- MUNDO --- */
test("buildWorld arma 17 salas con la inicial presente", () => {
  const w = buildWorld();
  assert.equal(Object.keys(w.rooms).length, 17);
  assert.ok(w.rooms[MISSION.start.room], "existe la sala inicial");
  assert.equal(w.start, MISSION.start.room);
});

test("GUARDARRAÍL: coordenadas UNIFICADAS — todo placeable usa x,y continuos (sin cx/cy de celda)", () => {
  for (const [k, def] of Object.entries(ROOMS))
    for (const bucket of ["objects", "sockets", "hazards"])
      for (const e of def[bucket] || []) {
        assert.ok(!("cx" in e) && !("cy" in e), `${k}.${bucket}: usa cx/cy (convención vieja); usa x,y continuos`);
        assert.ok(typeof e.x === "number" && typeof e.y === "number", `${k}.${bucket}: x,y deben ser números`);
        assert.ok(e.z === undefined || typeof e.z === "number", `${k}.${bucket}: z, si está, debe ser número`);
      }
  // makeRoom NORMALIZA z: tras armar, todo objeto/zócalo trae z numérico (def. 0) → física/render sin NaN.
  for (const [k, room] of Object.entries(buildWorld().rooms))
    for (const o of [...room.objects, ...room.sockets, ...room.hazards])
      assert.ok(typeof o.z === "number" && Number.isFinite(o.z), `${k}: z normalizado a número finito`);
});

test("roomThings/roomShell coherentes y roomSolids = sólidos de objetos ∪ cáscara", () => {
  const key = b => [b.x0, b.y0, b.z0, b.x1, b.y1, b.top ?? b.z1].map(n => +n.toFixed(6)).join(",");
  for (const [k, room] of Object.entries(buildWorld().rooms)) {
    // 1) cada placement (objetos + cáscara) referencia un asset válido y trae aabb bien formada
    for (const t of [...roomThings(room), ...roomShell(room)]) {
      assert.ok(ASSETS[t.asset], `${k}: asset desconocido ${t.asset}`);
      assert.ok(t.aabb && t.aabb.z1 >= t.aabb.z0, `${k}: aabb inválida en ${t.asset}`);
    }
    // 2) roomSolids es EXACTAMENTE la unión de: objetos sólidos (su aabb) + cáscara (paredes su caja,
    //    puertas sus dos postes `solids`). Estructura y objetos = el MISMO cálculo de colisión (AABB).
    const expected = [
      ...roomThings(room).filter(t => assetHas(t.asset, "solid")).map(t => t.aabb),
      ...roomShell(room).flatMap(t => t.solids || [t.aabb]),
    ];
    const got = roomSolids(room);
    assert.equal(got.length, expected.length, `${k}: nº de sólidos`);
    assert.deepEqual(got.map(key).sort(), expected.map(key).sort(), `${k}: cajas sólidas ≠ objetos∪cáscara`);
  }
});

test("roomShell = paredes (tramos) + postes de cada puerta (cajas del painter, todas las salas)", () => {
  const T = DOOR.T, W = DOOR.POST_W, span = (n) => [n / 2 - DOOR.SPAN_HALF, n / 2 + DOOR.SPAN_HALF];
  const segs = (n, s) => s ? [[0, s[0]], [s[1], n]] : [[0, n]];
  // Una puerta aporta sus DOS postes (extremos del vano) + el DINTEL (banda superior, ancho completo): 3
  // piezas del painter, no una caja entera (cada una se ordena sola → el robot se intercala entre postes y
  // bajo la viga).
  const posts = (axis, f) => axis === "x" ? [{ ...f, x1: f.x0 + W }, { ...f, x0: f.x1 - W }]
                                          : [{ ...f, y1: f.y0 + W }, { ...f, y0: f.y1 - W }];
  const lintel = (f) => ({ ...f, z0: WALL_H - DOOR.LINTEL_H });   // dintel: misma huella, solo la banda alta
  const doorBoxes = (axis, f) => [...posts(axis, f), lintel(f)];
  // (El vano de las puertas de FONDO no emite pieza propia: el sprite es transparente y deja ver el fondo.)
  // Pared TROCEADA por tile (N celdas): cada tramo del muro se parte en cajas locales (no un slab de toda la
  // fila). Mismo troceado que world.roomShell. N = ancho del tile de pared por defecto.
  const N = (ASSETS[WALL_TILE] && ASSETS[WALL_TILE].tile && ASSETS[WALL_TILE].tile.N) || 1;
  const wallTiles = (axis, c0, c1) => { const out = [];
    for (let i = c0; i + N <= c1 + 1e-6; i += N)
      out.push(axis === "x" ? { x0: i, y0: 0, z0: 0, x1: i + N, y1: 0, z1: WALL_H }
                            : { x0: 0, y0: i, z0: 0, x1: 0, y1: i + N, z1: WALL_H });
    return out; };
  // Cáscara esperada: paredes troceadas por tile + por puerta 2 postes + 1 dintel (fondo inset / frente protruido).
  const oldShell = (r) => {
    const b = [];
    for (const [c0, c1] of segs(r.w, r.exits.ym ? span(r.w) : null)) if (c1 > c0) b.push(...wallTiles("x", c0, c1));
    if (r.exits.ym) { const [s0, s1] = span(r.w); const f = { x0: s0, y0: -T, z0: 0, x1: s1, y1: 0, z1: WALL_H }; b.push(...doorBoxes("x", f)); }
    for (const [c0, c1] of segs(r.h, r.exits.xm ? span(r.h) : null)) if (c1 > c0) b.push(...wallTiles("y", c0, c1));
    if (r.exits.xm) { const [s0, s1] = span(r.h); const f = { x0: -T, y0: s0, z0: 0, x1: 0, y1: s1, z1: WALL_H }; b.push(...doorBoxes("y", f)); }
    if (r.exits.yp) { const [s0, s1] = span(r.w); b.push(...doorBoxes("x", { x0: s0, y0: r.h, z0: 0, x1: s1, y1: r.h + T, z1: WALL_H })); }
    if (r.exits.xp) { const [s0, s1] = span(r.h); b.push(...doorBoxes("y", { x0: r.w, y0: s0, z0: 0, x1: r.w + T, y1: s1, z1: WALL_H })); }
    return b;
  };
  const key = (a) => [a.x0, a.y0, a.z0, a.x1, a.y1, a.z1].map(n => +n.toFixed(6)).join(",");
  const sortKeys = (arr) => arr.map(key).sort();
  for (const [k, r] of Object.entries(buildWorld().rooms))
    assert.deepEqual(sortKeys(roomShell(r).map(t => t.aabb)), sortKeys(oldShell(r)), `${k}: cajas de cáscara ≠ literales de render`);
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

test("painter por HUELLA: el robot pegado por detrás de un objeto sub-celda queda DETRÁS", () => {
  // REGRESIÓN: el painter ordena por la MISMA huella (aabb) que la colisión. Como el robot choca con la huella
  // del objeto (no con una caja visual más ancha), al pegarse por detrás sus cajas se tocan en el MISMO borde →
  // separación por ejes limpia → el robot (detrás) se pinta antes. (Si la caja de orden fuese más ancha que
  // la huella, el par sería ambiguo y el robot —más alto— se dibujaría ENCIMA de circuitos/zócalos.)
  const p = ENGINE.projector(0, 0, { TILE_W: 34, TILE_H: 17, BLOCK_H: 17 });
  const circ  = { x0: 3.17, y0: 4.17, z0: 1, x1: 3.83, y1: 4.83, z1: 1.66, tag: "circ" };   // circuito (huella sub-celda)
  const robot = { x0: 2.53, y0: 4.18, z0: 1, x1: 3.17, y1: 4.82, z1: 2.50, tag: "robot" };  // pegado por −x (x1 = circ.x0), más alto
  assert.deepEqual(ENGINE.depthSort([circ, robot], p).map(b => b.tag), ["robot", "circ"],
    "el robot (detrás) debe pintarse ANTES que el circuito (delante)");
});

/* ---------------------------------------------------------------- FÍSICA --- */
test("colisión: se choca con un bloque y se anda por celda libre", () => {
  const r = buildWorld().rooms["0,0"];        // ENTRADA, bloque de la plataforma en (2,4)
  assert.equal(blocksHoriz(r, 2.5, 4.5, 0), true, "la celda del bloque bloquea");
  assert.equal(blocksHoriz(r, 0.5, 0.5, 0), false, "una celda libre no bloquea");
});

test("apoyo: el suelo es 0 y la cima de un bloque es su altura", () => {
  const r = buildWorld().rooms["0,0"];
  assert.equal(supportHeight(r, 0.5, 0.5, 0), 0, "suelo a z=0");
  assert.equal(supportHeight(r, 2.5, 4.5, 1), 1, "cima del bloque de 1 capa = 1");
});

test("STEP permite subir a superficies bajas (peana del zócalo ≤ STEP)", () => {
  assert.ok(SOCKET.BASE_H <= CFG.STEP, `la peana del zócalo (${SOCKET.BASE_H}) debe ser subible andando (STEP=${CFG.STEP})`);
});

test("el zócalo es SÓLIDO (no atravesable) y el robot SE SUBE a su peana andando", () => {
  const r = buildWorld().rooms["0,0"];        // ENTRADA, zócalo inactivo en celda (5,5)
  const sock = r.sockets[0];
  // 1) es sólido: aparece en roomSolids con la altura de su peana
  const solid = roomSolids(r).find(b => b.x0 > 5 && b.x0 < 6 && b.y0 > 5 && b.y0 < 6);
  assert.ok(solid, "el zócalo inactivo está entre los sólidos (no es atravesable)");
  assert.equal(solid.top, socketTop(sock), "su cima sólida = peana (socketTop)");
  // 2) NO bloquea el avance (es bajo): el robot entra en su celda andando…
  assert.equal(blocksHoriz(r, 5.5, 5.5, 0), false, "la peana baja no bloquea (se sube andando)");
  // 3) …y queda apoyado ENCIMA de la peana, no a z=0
  assert.equal(supportHeight(r, 5.5, 5.5, 0), SOCKET.BASE_H, "el robot se apoya sobre la peana");
});

/* ---------------------------------- ORÁCULO DE COLISIÓN DE LA CÁSCARA (paredes/puertas) ---
   Caracteriza el comportamiento ACTUAL de la colisión con paredes y puertas a través de la
   API PÚBLICA (blocksHoriz), NO de outOfBounds (interno, que la unificación reescribirá). Es
   el oráculo de no-regresión para mover la cáscara a roomSolids: la frontera del vano se DERIVA
   de las constantes DOOR (no hardcodeada), así que sigue válida si cambian. */
test("cáscara: paredes de fondo/esquina/borde frontal bloquean; el hueco de la puerta pasa (eje x)", () => {
  const r = buildWorld().rooms["0,0"];   // ENTRADA 8×8: paredes en x=0 e y=0; puertas xp (x=8) e yp (y=8)
  const GAP = DOOR.SPAN_HALF - DOOR.POST_W;          // semiancho passable del vano (= DOOR_HALF interno de physics)
  const half = GAP - CFG.PRAD;                       // semiancho passable del CENTRO del robot (radio PRAD)
  // paredes de fondo (x=0, y=0) y esquina: bloquean
  assert.equal(blocksHoriz(r, 0.05, 2.5, 0), true, "pared de fondo x=0 bloquea");
  assert.equal(blocksHoriz(r, 2.5, 0.05, 0), true, "pared de fondo y=0 bloquea");
  assert.equal(blocksHoriz(r, 0.05, 0.05, 0), true, "esquina de fondo (dos paredes) bloquea");
  // borde FRONTAL abierto, fuera del vano (no hay pared dibujada, pero el envelope bloquea)
  assert.equal(blocksHoriz(r, r.w - 0.05, 1.0, 0), true, "borde frontal x=w fuera del vano bloquea");
  // hueco de la puerta xp (vano centrado en y=h/2): PASA, y la frontera es exacta a ±(GAP−PRAD)
  assert.equal(blocksHoriz(r, r.w - 0.05, r.h / 2, 0), false, "el centro del vano (puerta xp) pasa");
  assert.equal(blocksHoriz(r, r.w - 0.05, r.h / 2 + half - 0.02, 0), false, "justo dentro del vano pasa");
  assert.equal(blocksHoriz(r, r.w - 0.05, r.h / 2 + half + 0.02, 0), true,  "justo fuera del vano bloquea");
  // las paredes NO crean superficie pisable (cima muy alta) ni el suelo cambia
  assert.equal(supportHeight(r, 0.5, 0.5, 0), 0, "junto a las paredes el apoyo sigue siendo el suelo");
});

test("cáscara: el hueco de una puerta de FONDO también pasa (eje y)", () => {
  const r = buildWorld().rooms["2,0"];   // NUDO 6×6: puerta de fondo ym (y=0), vano centrado en x=w/2=3
  assert.equal(blocksHoriz(r, r.w / 2, 0.05, 0), false, "el centro del vano (puerta ym) pasa");
  assert.equal(blocksHoriz(r, 1.0, 0.05, 0), true, "la pared de fondo y=0 fuera del vano bloquea");
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
  assert.equal(entrada.objects.length, 3, "ENTRADA arranca con 3 (2 bloques de la plataforma + circuito)");
  player.x = 3.5; player.y = 4.5; player.z = 1.66; game.carried = null;   // subido sobre el circuito de la plataforma
  interact(entrada);
  assert.equal(game.carried, "prop_cube", "lleva el circuito cubo (carried = asset id)");
  assert.equal(entrada.objects.length, 2, "el circuito ya no está suelto (quedan los 2 bloques)");
});

test("colocar la forma correcta en su zócalo lo activa y suma circuito", () => {
  resetGame();
  const entrada = room;
  player.x = 5.5; player.y = 5.5; player.z = 0; game.carried = "prop_cube";   // carried = asset id; casilla del zócalo cube (5,5)
  const before = game.circuits;
  interact(entrada);
  assert.equal(game.carried, null, "el circuito se coloca");
  assert.equal(entrada.sockets[0].filled, "cube", "el zócalo queda con la FORMA puesta (filled = shape)");
  assert.equal(game.circuits, before + 1, "el contador de circuitos sube");
});

test("colocar el último circuito gana la partida", () => {
  resetGame();
  game.circuits = game.circuitsTotal - 1;      // a falta de uno
  player.x = 5.5; player.y = 5.5; player.z = 0; game.carried = "prop_cube";   // carried = asset id
  interact(room);
  assert.equal(game.won, true, "game.won al completar todos");
});

/* ---------------------------------------------- GRAVEDAD DE OBJETOS -------- */
test("un objeto en el aire cae hasta su apoyo", () => {
  resetGame();
  const o = room.objects.find(e => e.shape);   // el circuito de ENTRADA (cae); el bloque no tiene `falls`
  o.x = 0.5; o.y = 0.5; o.z = 2; o.vz = 0;     // a una celda VACÍA y en el aire → debe caer al suelo
  for (let i = 0; i < 240; i++) updateObjects(room, 1 / 60);
  assert.ok(o.z <= 1e-3, "termina en el suelo (z≈0)");
});

/* ---------------------------------------------- EMPUJE EN EL AIRE (salto) -------- */
test("empuje EN EL AIRE: choca con un movable a la altura del pie y lo empuja; por encima NO", () => {
  // A SU ALTURA: robot en el aire, bajo, avanzando contra un movable → lo empuja.
  resetGame();
  room.objects.push({ asset: "computer", x: 2.5, y: 2.5, z: 0 });   // movable de prueba en suelo despejado
  const comp = room.objects[room.objects.length - 1];
  Object.assign(player, { x: 1.9, y: 2.5, z: 0.3, vx: 2.2, vy: 0, vz: 1.0,
    onGround: false, facing: 0, jdx: 1, jdy: 0, jumpPending: false, turnTimer: 0 });
  const cx0 = comp.x;
  for (let i = 0; i < 5; i++) player.update(room, 1 / 60);
  assert.ok(comp.x > cx0 + 1e-3, "el movable se empuja en mitad del salto");

  // POR ENCIMA (cima del movable 0.7 < pies+STEP): salta por encima, NO lo empuja.
  resetGame();
  room.objects.push({ asset: "computer", x: 2.5, y: 2.5, z: 0 });
  const comp2 = room.objects[room.objects.length - 1];
  Object.assign(player, { x: 1.9, y: 2.5, z: 1.0, vx: 2.2, vy: 0, vz: 0.5,
    onGround: false, facing: 0, jdx: 1, jdy: 0, jumpPending: false, turnTimer: 0 });
  const cx2 = comp2.x;
  for (let i = 0; i < 5; i++) player.update(room, 1 / 60);
  assert.equal(comp2.x, cx2, "saltando por encima NO se empuja");
});

/* ----------------------------------- RESET: SIN FUGA DE ESTADO ENTRE PARTIDAS -- */
test("resetGame reconstruye el mundo sin arrastrar estado mutado", () => {
  // ensucia el estado
  resetGame();
  player.x = 5.5; player.y = 5.5; player.z = 0; game.carried = "prop_cube";   // carried = asset id
  interact(room);                              // coloca el cubo en el zócalo (ensucia estado)
  // reinicia
  resetGame();
  assert.equal(game.circuits, 0, "circuitos a 0");
  assert.equal(game.carried, null, "manos vacías");
  assert.equal(game.won, false, "no ganado");
  assert.equal(room.name, "ENTRADA", "vuelve a la entrada");
  assert.equal(player.x, MISSION.start.x); assert.equal(player.y, MISSION.start.y);
  assert.equal(room.objects.length, 3, "los objetos de ENTRADA vuelven (2 bloques + circuito, clones frescos)");
  assert.equal(room.sockets[0].filled, null, "el zócalo vuelve a estar vacío");
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
