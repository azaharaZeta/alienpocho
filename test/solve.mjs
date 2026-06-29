/* =============================================================================
   ALIEN POCHO — VALIDADOR DE SOLUBILIDAD DEL PUZZLE (test/solve.mjs)
   -----------------------------------------------------------------------------
   Oráculo de no-regresión de DISEÑO (no de código): demuestra que la MISIÓN tiene
   solución, es decir, que el robot puede COGER un circuito de cada forma pedida y
   LLEVARLO a su zócalo. Pilla mapas rotos al editar data/rooms.js (un circuito
   tapiado por mobiliario, un zócalo inalcanzable, una zona desconectada del inicio).

   MODELO (reducción válida para el puzzle actual): el robot lleva UN circuito a la
   vez, los obstáculos son ESTÁTICOS y colocar un circuito no corta caminos → basta
   con la ALCANZABILIDAD: si cada zócalo es alcanzable y hay ≥ tantos circuitos
   alcanzables de cada forma como zócalos la piden, el puzzle se resuelve (de uno en
   uno). NO modela saltos/empuje/transmutación: si se añaden mecánicas que los
   requieran en el camino crítico, habrá que enriquecer el modelo (ver idea-validador-solubilidad).

   Reutiliza la FÍSICA real (canStandOn/supportHeight) y la geometría de puerta
   (doorSpan) — sin cálculo paralelo: una celda es "pisable" si el robot puede estar
   de pie en ella a su altura de apoyo, exactamente como en el juego.
   Ejecutar:  node test/solve.mjs   (o  npm test)
   ============================================================================= */
import assert from "node:assert/strict";

import { buildWorld, doorSpan, objAsset } from "../src/world.js";
import { canStandOn, supportHeight } from "../src/physics.js";
import { MISSION } from "../src/data/mission.js";
import { assetHas } from "../src/data/assets.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}
console.log("ALIEN POCHO — solubilidad del puzzle\n");

const OPP = { xp: "xm", xm: "xp", yp: "ym", ym: "yp" };

/* ¿Puede el robot estar de pie en el centro de la celda (cx,cy)? A su altura de APOYO (suelo, o cima
   de una peana baja como el zócalo) — misma física que el juego. Lo que estorba arriba lo veta canStandOn. */
function occupiable(room, cx, cy) {
  const x = cx + 0.5, y = cy + 0.5;
  const fz = supportHeight(room, x, y, 0);   // apoyo bajo los pies (0 = suelo; 0.24 = peana del zócalo)
  return canStandOn(room, x, y, fz);
}

/* Celdas del VANO de una puerta en su borde (las que el robot pisa para cruzar). doorSpan = misma
   geometría que la cáscara; las 2 celdas centrales del borde. */
function openingCells(room, dir) {
  const { w, h } = room;
  const cells = [];
  if (dir === "xp" || dir === "xm") {
    const [a, b] = doorSpan(h), fixed = dir === "xp" ? w - 1 : 0;
    for (let cy = Math.round(a); cy < Math.round(b); cy++) cells.push([fixed, cy]);
  } else {
    const [a, b] = doorSpan(w), fixed = dir === "yp" ? h - 1 : 0;
    for (let cx = Math.round(a); cx < Math.round(b); cx++) cells.push([cx, fixed]);
  }
  return cells;
}

/* Flood-fill GLOBAL de las celdas pisables alcanzables desde el arranque, cruzando puertas. Una puerta
   conecta sus celdas de vano (en la sala A) con las del vano OPUESTO (en la sala destino B). */
function reachableFrom(rooms, startRoom, startCell) {
  const seen = new Set(), key = (r, x, y) => `${r}:${x},${y}`;
  const q = [[startRoom, startCell[0], startCell[1]]]; seen.add(key(...q[0]));
  while (q.length) {
    const [rk, cx, cy] = q.shift(), room = rooms[rk];
    const push = (r, x, y) => { const k = key(r, x, y); if (!seen.has(k)) { seen.add(k); q.push([r, x, y]); } };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {     // vecinos pisables dentro de la sala
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < room.w && ny < room.h && occupiable(room, nx, ny)) push(rk, nx, ny);
    }
    for (const [dir, target] of Object.entries(room.exits || {})) {  // cruzar puerta si estoy en su vano
      if (!rooms[target]) continue;
      if (openingCells(room, dir).some(([ox, oy]) => ox === cx && oy === cy))
        for (const [ex, ey] of openingCells(rooms[target], OPP[dir]))
          if (occupiable(rooms[target], ex, ey)) push(target, ex, ey);
    }
  }
  return seen;
}

/* ---------- El test ---------- */
test("la misión es RESOLUBLE: cada zócalo es alcanzable y hay circuitos alcanzables de su forma", () => {
  const { rooms, start } = buildWorld();
  const reached = reachableFrom(rooms, start, [Math.floor(MISSION.start.x), Math.floor(MISSION.start.y)]);
  const inReach = (rk, cx, cy) => reached.has(`${rk}:${cx},${cy}`);
  const shapeOf = (o) => o.shape || objAsset(o).replace(/^prop_/, "");

  // 1) cada ZÓCALO alcanzable (el robot puede plantarse en su celda — la peana es subible)
  const need = {};                                  // forma → nº de zócalos que la piden
  for (const [rk, room] of Object.entries(rooms))
    for (const s of room.sockets) {
      const cx = Math.floor(s.x), cy = Math.floor(s.y);
      assert.ok(inReach(rk, cx, cy), `zócalo "${s.id}" (sala ${rk}, celda ${cx},${cy}) NO es alcanzable a pie`);
      need[MISSION.requires[s.id]] = (need[MISSION.requires[s.id]] || 0) + 1;
    }

  // 2) cada CIRCUITO: ¿hay una celda pisable ADYACENTE alcanzable para cogerlo? (el circuito es sólido)
  const have = {};                                  // forma → nº de circuitos cogibles
  for (const [rk, room] of Object.entries(rooms))
    for (const o of room.objects) {
      if (!assetHas(objAsset(o), "carriable")) continue;
      const cx = Math.floor(o.x), cy = Math.floor(o.y);
      const pickable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inReach(rk, cx + dx, cy + dy));
      if (pickable) have[shapeOf(o)] = (have[shapeOf(o)] || 0) + 1;
    }

  // 3) balance ALCANZABLE: por cada forma pedida, hay ≥ tantos circuitos cogibles como zócalos
  for (const [shape, n] of Object.entries(need))
    assert.ok((have[shape] || 0) >= n,
      `forma "${shape}": ${n} zócalo(s) la piden pero solo ${have[shape] || 0} circuito(s) son ALCANZABLES y cogibles`);
});

console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
