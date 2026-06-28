/* =============================================================================
   ALIEN POCHO — TEST DE INTEGRIDAD MISIÓN ↔ MAPA (test/mission.mjs)
   -----------------------------------------------------------------------------
   Oráculo de no-regresión de las TRES capas de datos cruzadas (no de la lógica):
   que data/rooms.js (DÓNDE) y data/mission.js (QUÉ lograr) sean COHERENTES, para
   que el puzzle siempre se pueda completar. Pilla al editar datos errores que el
   juego no avisa (un zócalo sin `requires` queda incompletable pero sigue sumando
   en circuitsTotal → misión imposible en silencio).

   Comprueba:
     1) Cada zócalo (por su `id`) tiene entrada en MISSION.requires, y al revés (sin huérfanos).
     2) Los `id` de zócalo son ÚNICOS en todo el mundo.
     3) Balance: para cada forma pedida hay ≥ tantos circuitos colocados como zócalos la piden.
     4) `missionTotal` (derivado) == nº de zócalos == nº de entradas de `requires`.
     5) Cada `exits` tiene su RECÍPROCO en la sala destino (y el destino existe).
     6) MISSION.start apunta a una sala existente y su (x,y) cae dentro de ella.
   Ejecutar:  node test/mission.mjs   (o  npm test)
   ============================================================================= */
import assert from "node:assert/strict";

import { ROOMS } from "../src/data/rooms.js";
import { MISSION, missionTotal } from "../src/data/mission.js";
import { objAsset } from "../src/world.js";
import { assetHas } from "../src/data/assets.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}

console.log("ALIEN POCHO — integridad misión ↔ mapa\n");

/* Todos los zócalos del mundo con la sala donde viven (para mensajes claros). */
const allSockets = [];
for (const [key, r] of Object.entries(ROOMS))
  for (const s of (r.sockets || [])) allSockets.push({ ...s, room: key });

/* Forma de un objeto colocable: `shape` directo, o derivada del asset prop_<shape>. */
const shapeOf = (o) => o.shape || objAsset(o).replace(/^prop_/, "");

/* ---------- 1) Cada zócalo está en `requires`, y `requires` no tiene huérfanos ---------- */
test("cada zócalo (id) tiene entrada en MISSION.requires", () => {
  for (const s of allSockets)
    assert.ok(MISSION.requires[s.id] != null,
      `zócalo "${s.id}" (sala ${s.room}) no está en MISSION.requires → incompletable pero suma en el total`);
});

test("MISSION.requires no tiene entradas huérfanas (sin zócalo)", () => {
  const ids = new Set(allSockets.map(s => s.id));
  for (const id of Object.keys(MISSION.requires))
    assert.ok(ids.has(id), `MISSION.requires["${id}"] no corresponde a ningún zócalo de data/rooms.js`);
});

/* ---------- 2) Unicidad de los id de zócalo ---------- */
test("los id de zócalo son únicos en todo el mundo", () => {
  const seen = new Map();
  for (const s of allSockets) {
    assert.ok(!seen.has(s.id), `id de zócalo duplicado "${s.id}" (salas ${seen.get(s.id)} y ${s.room})`);
    seen.set(s.id, s.room);
  }
});

/* ---------- 3) Balance circuitos colocados ≥ zócalos que los piden (por forma) ---------- */
test("hay al menos tantos circuitos colocados como zócalos de cada forma", () => {
  const need = {};                                   // forma → nº de zócalos que la piden
  for (const s of allSockets) need[MISSION.requires[s.id]] = (need[MISSION.requires[s.id]] || 0) + 1;
  const have = {};                                   // forma → nº de circuitos (carriable) colocados
  for (const r of Object.values(ROOMS))
    for (const o of (r.objects || []))
      if (assetHas(objAsset(o), "carriable")) have[shapeOf(o)] = (have[shapeOf(o)] || 0) + 1;
  for (const [shape, n] of Object.entries(need))
    assert.ok((have[shape] || 0) >= n,
      `forma "${shape}": ${n} zócalo(s) la piden pero solo hay ${have[shape] || 0} circuito(s) colocado(s)`);
});

/* ---------- 4) El total derivado cuadra con zócalos y con requires ---------- */
test("missionTotal == nº de zócalos == nº de entradas de requires", () => {
  assert.equal(missionTotal(ROOMS), allSockets.length, "missionTotal ≠ nº de zócalos");
  assert.equal(allSockets.length, Object.keys(MISSION.requires).length, "nº de zócalos ≠ nº de entradas en requires");
});

/* ---------- 5) Cada salida tiene su recíproca y el destino existe ---------- */
test("cada exit tiene su recíproco en la sala destino", () => {
  const OPP = { xp: "xm", xm: "xp", yp: "ym", ym: "yp" };
  for (const [key, r] of Object.entries(ROOMS))
    for (const [dir, target] of Object.entries(r.exits || {})) {
      assert.ok(OPP[dir], `sala ${key}: dirección de salida desconocida "${dir}"`);
      const dest = ROOMS[target];
      assert.ok(dest, `sala ${key}: salida ${dir} apunta a "${target}" inexistente`);
      assert.equal(dest.exits && dest.exits[OPP[dir]], key,
        `sala ${key} sale por ${dir} a ${target}, pero ${target} no vuelve por ${OPP[dir]} a ${key}`);
    }
});

/* ---------- 6) El arranque cae dentro de una sala existente ---------- */
test("MISSION.start apunta a una sala válida y (x,y) cae dentro", () => {
  const r = ROOMS[MISSION.start.room];
  assert.ok(r, `MISSION.start.room "${MISSION.start.room}" no existe en data/rooms.js`);
  assert.ok(MISSION.start.x >= 0 && MISSION.start.x <= r.w, `start.x ${MISSION.start.x} fuera de [0,${r.w}]`);
  assert.ok(MISSION.start.y >= 0 && MISSION.start.y <= r.h, `start.y ${MISSION.start.y} fuera de [0,${r.h}]`);
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
