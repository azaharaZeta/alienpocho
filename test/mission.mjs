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
import { objAsset, buildWorld } from "../src/world.js";
import { assetHas, ASSETS } from "../src/data/assets.js";
import { objSupport } from "../src/physics.js";
import { roomThings } from "../src/world.js";
import { isBehindDoor, doorBlockedCells } from "../src/occlusion.js";

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

/* ---------- 7) Ningún asset cae FLAGRANTEMENTE detrás del marco de una puerta frontal ----------
   El marco de las puertas xp/yp (alto, protruido) se pinta delante y tapa lo que haya en su columna
   iso. Un asset ahí se ve a medias o no se ve. La zona la calcula src/occlusion.js (reutilizable por
   el generador de mapas del roguelike). Pilla colocaciones a ciegas al editar data/rooms.js. */
test("ningún objeto/zócalo/peligro queda detrás del marco de una puerta (occlusion.js)", () => {
  for (const [key, room] of Object.entries(buildWorld().rooms)) {
    const items = [
      ...room.objects.map(o => [objAsset(o), o.x, o.y]),
      ...room.sockets.map(s => ["socket:" + s.id, s.x, s.y]),
      ...room.hazards.map(h => ["spikes", h.x, h.y]),
    ];
    for (const [name, x, y] of items)
      assert.ok(!isBehindDoor(room, x, y),
        `sala ${key}: "${name}" en (${x},${y}) cae detrás de una puerta frontal (celdas bloqueadas: ` +
        doorBlockedCells(room).map(c => c.cx + "," + c.cy).join(" ") + ")");
  }
});

/* ---------- 8) Los assets `onTable` están colocados SOBRE una mesa (no en el suelo) ----------
   monitor / lámpara / papeles van por defecto encima de una mesa: en el mapa deben llevar z = cima de la
   mesa y descansar sobre un sólido (no flotando ni en el suelo). Pilla colocaciones olvidadas. */
test("los assets onTable están colocados sobre una superficie (no en el suelo)", () => {
  for (const [k, room] of Object.entries(buildWorld().rooms))
    for (const o of room.objects) {
      const id = objAsset(o);
      if (!(ASSETS[id] && ASSETS[id].onTable)) continue;
      assert.ok(o.z > 0, `${k}: "${id}" en (${o.x},${o.y}) es onTable pero está en el suelo (z=0)`);
      assert.ok(Math.abs(objSupport(room, o) - o.z) < 1e-6,
        `${k}: "${id}" (z=${o.z}) no descansa sobre una superficie (apoyo=${objSupport(room, o)})`);
    }
});

/* ---------- 9) Ningún par de SÓLIDOS colocados se SOLAPA (en planta + rango z) ----------
   Dos sólidos solapados a la misma altura ATRAPAN al móvil: objBlocked rechaza todo destino que siga
   solapando → no se puede empujar para separarlos (bug "se enganchan", CRUCE silla∩mesa). En el juego no
   pueden nacer solapes (no se empuja DENTRO de un sólido); solo de datos mal puestos. Apilar es legítimo
   (rangos z ADYACENTES: monitor sobre la mesa, base==cima) → se exige solape z ESTRICTO para no marcarlo. */
test("ningún par de objetos sólidos se solapa (planta + z) — no atraparía a un móvil", () => {
  const ovXY = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const ovZ  = (a, b) => a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;   // estricto: apilado (base==cima) NO cuenta
  for (const [key, room] of Object.entries(buildWorld().rooms)) {
    const solids = roomThings(room).filter(t => assetHas(t.asset, "solid"));
    for (let i = 0; i < solids.length; i++)
      for (let j = i + 1; j < solids.length; j++)
        assert.ok(!(ovXY(solids[i].aabb, solids[j].aabb) && ovZ(solids[i].aabb, solids[j].aabb)),
          `sala ${key}: "${solids[i].asset}"(${solids[i].x},${solids[i].y}) y "${solids[j].asset}"(${solids[j].x},${solids[j].y}) ` +
          `se SOLAPAN a la misma altura → el móvil quedaría enganchado. Sepáralos (o apila con z = cima del de abajo).`);
  }
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
