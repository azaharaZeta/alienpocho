/* =============================================================================
   ALIEN POCHO — TEST DE ASSETS / FUENTE ÚNICA (test/assets.mjs)
   -----------------------------------------------------------------------------
   Guarda que `src/data/assets.js` siga siendo la ÚNICA fuente de verdad de los
   assets (ver docs/ARQUITECTURA.md):
     1) Coherencia interna del registro (cada asset bien formado; helpers derivan bien).
     2) NO-DERIVA contra los artefactos: manifest.json y los sprites de AP cuadran
        con el registro; los ficheros referenciados existen en disco.
     3) GUARDARRAÍL: la tool tools/tool-assets.html NO reintroduce geometría hardcodeada.
   Ejecutar:  node test/assets.mjs   (o  npm test)
   ============================================================================= */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ASSETS, assetBox, assetRef, assetFoot, assetRegion, assetsByGroup, GROUP_ORDER, PROP, ROBOT, DOOR, SOCKET, WALL_H } from "../src/data/assets.js";
import { AP } from "../src/draw.js";

const root = fileURLToPath(new URL("..", import.meta.url));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}

console.log("ALIEN POCHO — assets / fuente única\n");

/* ---------- 1) Coherencia interna del registro ---------- */
test("cada asset tiene draw y (foot | variants con box/foot)", () => {
  for (const [id, a] of Object.entries(ASSETS)) {
    assert.ok(a.draw, `${id}: falta draw`);
    const hasFoot = !!a.foot, hasVar = a.variants && Object.keys(a.variants).length;
    assert.ok(hasFoot || hasVar, `${id}: ni foot ni variants`);
    if (a.foot) for (const k of ["w", "l", "h"]) assert.equal(typeof a.foot[k], "number", `${id}.foot.${k}`);
    if (a.sprite) for (const k of ["w", "h", "minX", "minY"]) assert.equal(typeof a.sprite[k], "number", `${id}.sprite.${k}`);
  }
});

test("cada asset DECLARA kind, group y traits (clase + propiedades componibles)", () => {
  const KINDS = new Set(["structure", "individual", "object"]);
  const TRAITS = new Set(["solid", "movable", "carriable", "falls", "hazard", "receptacle", "stateful", "controlled"]);
  for (const [id, a] of Object.entries(ASSETS)) {
    assert.ok(KINDS.has(a.kind), `${id}: kind "${a.kind}" desconocido`);
    assert.ok(GROUP_ORDER.includes(a.group), `${id}: group "${a.group}" no está en GROUP_ORDER`);
    assert.equal(typeof a.traits, "object", `${id}: falta traits`);
    for (const [t, v] of Object.entries(a.traits)) {
      assert.ok(TRAITS.has(t), `${id}: trait "${t}" desconocido`);
      assert.equal(typeof v, "boolean", `${id}.traits.${t} debe ser boolean`);
    }
  }
});

test("assetsByGroup agrupa TODOS los assets y respeta GROUP_ORDER", () => {
  const groups = assetsByGroup();
  const total = groups.reduce((n, g) => n + g.ids.length, 0);
  assert.equal(total, Object.keys(ASSETS).length, "assetsByGroup pierde/duplica assets");
  const titles = groups.map(g => g.title).filter(t => GROUP_ORDER.includes(t));
  assert.deepEqual(titles, GROUP_ORDER.filter(g => titles.includes(g)), "orden de grupos ≠ GROUP_ORDER");
});

test("assetBox/assetRef/assetRegion devuelven algo coherente para todos", () => {
  for (const id of Object.keys(ASSETS)) {
    const b = assetBox(id), r = assetRef(id), reg = assetRegion(id);
    assert.ok(b && typeof b.w === "number", `${id}: assetBox`);
    assert.ok(r && typeof r.x === "number", `${id}: assetRef`);
    // región ⊇ caja (contenedor estándar nunca menor que la caja)
    assert.ok(reg.w >= Math.ceil(b.w) - 1e-9 && reg.h >= b.h - 1e-9, `${id}: región < caja`);
  }
});

test("anclaje = esquina (0,0) + offset; footMode sitúa la huella (center/corner)", () => {
  // Modelo: ancla = esquina + offset (+footMode); el campo `anchor`/`footAnchor` NO debe existir.
  assert.ok(!("anchor" in ASSETS.cube) && !("footAnchor" in ASSETS.cube), "queda un campo `anchor`/`footAnchor` viejo");
  assert.deepEqual(ASSETS.cube.offset, { x: 0.5, y: 0.5 }); assert.equal(ASSETS.cube.footMode, "center");
  assert.deepEqual(ASSETS.floor.offset, { x: 0, y: 0 });    assert.equal(ASSETS.floor.footMode, "corner");
  // corner (estructura): floor ⇒ ancla en (0,0,0) y caja desde la esquina
  assert.deepEqual(assetRef("floor"), { x: 0, y: 0, z: 0 });
  assert.deepEqual(assetBox("floor"), { x: 0, y: 0, z: 0, w: 1, l: 1, h: 0 });
  // center (objetos): cube ⇒ ancla en (0.5,0.5,0) (1×1 centrado = misma caja [0,1]); spikes ⇒ huella centrada
  assert.deepEqual(assetRef("cube"), { x: 0.5, y: 0.5, z: 0 });
  assert.deepEqual(assetBox("cube"), { x: 0, y: 0, z: 0, w: 1, l: 1, h: 1 });
  const s = assetBox("spikes"); assert.ok(Math.abs(s.x - (0.5 - s.w / 2)) < 1e-9);
});

test("ORÁCULO DE PÍXEL: el blit del sprite respecto a la esquina (0,0,0) es ESTABLE (identidad)", () => {
  // Punto de pantalla donde se dibuja la esquina sup-izq del sprite, RELATIVO a P(esquina de celda):
  //   proyección(assetRef) + (minX,minY).  Compone anclaje + encuadre = lo que el usuario quiere invariante.
  // Congelado con los datos actuales: la reparametrización a offset+footMode NO debe moverlo (mismo píxel).
  const TW = 34, TH = 17, BH = 17;
  const blit = (id) => { const r = assetRef(id), s = ASSETS[id].sprite;
    return [ (r.x - r.y) * TW / 2 + s.minX, (r.x + r.y) * TH / 2 - r.z * BH + s.minY ]; };
  const FROZEN = {
    cube: [-17, -17], prop_cube: [-11, -7.5], prop_pyramid: [-11, -2.5], prop_dome: [-9, -0.5],
    prop_cylinder: [-8, -6.5], socket: [-16, -3.5], spikes: [-7, -1.5], plant: [-4, -2.5],
    drone: [-6, -13.5], computer: [-9, -8.5],
  };
  for (const [id, a] of Object.entries(ASSETS)) {
    if (!a.sprite) continue;
    assert.ok(FROZEN[id], `${id}: sprite sin valor congelado en el oráculo (añádelo)`);
    assert.deepEqual(blit(id), FROZEN[id], `${id}: el blit-vs-esquina cambió (¿se movió el anclaje o el sprite?)`);
  }
});

test("GUARDARRAÍL anti-#2: la caja de orden (huella) ACOTA el sprite dibujado (≤ TOL px)", () => {
  // El painter ordena por la HUELLA (assetBox); el sprite se dibuja anclado en assetRef + (minX,minY).
  // Si sus píxeles se salen MUCHO de la caja, el orden de pintado no los acota → mis-orden de profundidad (#2,
  // ver docs/ideas/assessment-motor-iso.md). Hoy todo lo colocable cumple ≤0.85px; este test lo FIJA: un sprite
  // alto/flotante NUEVO que escape su huella se detecta aquí → darle huella honesta o, si colisión y silueta deben
  // diferir de verdad, declarar `bounds` visual (refactor pendiente: docs/ideas/idea-motor-bounds-visuales.md).
  const TW = 34, TH = 17, BH = 17, TOL = 2;
  const P = (x, y, z) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * BH });
  for (const [id, a] of Object.entries(ASSETS)) {
    if (!a.sprite) continue;                                  // solo assets de sprite (pared/puerta/robot van por otra vía)
    const b = assetBox(id), r = assetRef(id), s = a.sprite;
    const C = [[b.x, b.y, b.z], [b.x + b.w, b.y, b.z], [b.x + b.w, b.y + b.l, b.z], [b.x, b.y + b.l, b.z],
              [b.x, b.y, b.z + b.h], [b.x + b.w, b.y, b.z + b.h], [b.x + b.w, b.y + b.l, b.z + b.h], [b.x, b.y + b.l, b.z + b.h]]
              .map(c => P(c[0], c[1], c[2]));                 // 8 esquinas de la caja → AABB de pantalla
    const box = { xMin: Math.min(...C.map(p => p.x)), xMax: Math.max(...C.map(p => p.x)),
                  yMin: Math.min(...C.map(p => p.y)), yMax: Math.max(...C.map(p => p.y)) };
    const ref = P(r.x, r.y, r.z);                             // ancla del sprite (igual que el draw)
    const spr = { xL: ref.x + s.minX, xR: ref.x + s.minX + s.w, yT: ref.y + s.minY, yB: ref.y + s.minY + s.h };
    const ov = Math.max(box.yMin - spr.yT, spr.yB - box.yMax, box.xMin - spr.xL, spr.xR - box.xMax);  // peor lado
    assert.ok(ov <= TOL, `${id}: el sprite escapa su caja de orden ${ov.toFixed(1)}px (> ${TOL}) → #2; dale huella honesta o declara bounds visual`);
  }
});

test("variantes de orientación intercambian ancho/largo (robot) y caja por eje (puerta)", () => {
  const rx = assetBox("robot", "axisX"), ry = assetBox("robot", "axisY");
  assert.ok(Math.abs(rx.w - ry.l) < 1e-9 && Math.abs(rx.l - ry.w) < 1e-9, "robot: no se intercambian w/l");
  const dx = assetBox("door", "axisX"), dy = assetBox("door", "axisY");
  assert.ok(dx.w !== dy.w && dx.l !== dy.l, "puerta: las cajas por eje deberían diferir");
});

/* ---------- 2) NO-DERIVA contra artefactos ---------- */
test("AP.SPRITES == los sprites del registro (sin segunda copia)", () => {
  const fromReg = Object.fromEntries(Object.entries(ASSETS).filter(([, a]) => a.sprite).map(([id, a]) => [id, a.sprite]));
  assert.deepEqual(new Set(Object.keys(AP.SPRITES)), new Set(Object.keys(fromReg)), "claves de SPRITES");
  for (const id of Object.keys(fromReg))
    for (const k of ["w", "h", "minX", "minY"]) assert.equal(AP.SPRITES[id][k], fromReg[id][k], `${id}.${k}`);
});

test("manifest.json NO diverge del registro (w/h de sprites, tiles de pared y puerta)", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/svg/manifest.json", import.meta.url), "utf8"));
  const byFile = new Map(manifest.map(e => [e.file, e]));
  const check = (file, dim, label) => { const e = file && byFile.get(file); if (!e) return;   // sin entrada en manifest: se ignora
    assert.equal(e.w, dim.w, `manifest ${file}.w (=${e.w}) ≠ registro ${label} (=${dim.w})`);
    assert.equal(e.h, dim.h, `manifest ${file}.h (=${e.h}) ≠ registro ${label} (=${dim.h})`); };
  for (const [id, a] of Object.entries(ASSETS)) {
    const dim = a.sprite || a.tile;                                // sprite (anclado) o tile (pared)
    if (dim && a.files && a.files.svg) check(a.files.svg, dim, id);
    // tiles front/back de la puerta: comparten UN solo fichero (door.svg); ambos offsets contra esa entrada
    if (a.tiles) for (const [k, d] of Object.entries(a.tiles)) check(a.files && a.files.svg, d, `${id}.tiles.${k}`);
  }
});

test("los ficheros SVG/PNG referenciados por el registro existen en disco", () => {
  for (const [id, a] of Object.entries(ASSETS)) {
    if (!a.files) continue;
    if (a.files.svg) assert.ok(existsSync(root + "assets/svg/" + a.files.svg), `${id}: falta assets/svg/${a.files.svg}`);
    if (a.files.png) assert.ok(existsSync(root + "assets/png/" + a.files.png), `${id}: falta assets/png/${a.files.png}`);
  }
});

/* ---------- 3) GUARDARRAÍL: la tool no re-hardcodea geometría ---------- */
test("GUARDARRAÍL: el encuadre de pared/puerta vive en el REGISTRO (draw.js no lo redefine)", () => {
  const src = readFileSync(new URL("../src/draw.js", import.meta.url), "utf8");
  for (const bad of ["WALL_TILES", "DOOR_TILES"])
    assert.ok(!src.includes(bad), `draw.js define ${bad} → el encuadre {N,w,h,minX,minY} debe leerse de ASSETS[...].tile / ASSETS.door.tiles`);
});

test("tools/tool-assets.html no contiene mapas de geometría hardcodeada (GU/BOX/REF/box*)", () => {
  const html = readFileSync(new URL("../tools/tool-assets.html", import.meta.url), "utf8");
  for (const bad of [/\bconst\s+GU\s*=/, /\bconst\s+BOX\s*=/, /\bconst\s+REF\s*=/,
                     /\bconst\s+boxProp\s*=/, /\bconst\s+boxSocket\s*=/, /\bconst\s+guProp\s*=/, /\bconst\s+guSocket\s*=/])
    assert.ok(!bad.test(html), `la tool reintrodujo un mapa de geometría: ${bad}`);
  // tampoco debería importar la geometría desde config (su hogar es data/assets.js)
  assert.ok(!/from\s+["']\.\.\/src\/config\.js["'][^\n]*\b(PROP|ROBOT|DOOR|SOCKET|WALL_H)\b/.test(html),
    "la tool importa geometría desde config.js en vez de data/assets.js");
});

test("GUARDARRAÍL: render.js dibuja TODO (objetos Y cáscara) por el motor genérico, no por nombre", () => {
  const src = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  // La cáscara (paredes/puertas, incl. el vacío del vano) va por roomShell + AP.drawAsset, IGUAL que los
  // objetos. Solo se permite por nombre el ÚNICO pre-pase de fondo z=0 (AP.floor) + AP.drawSprite (icono HUD).
  // AP.doorHole ya NO se llama desde render (es una pieza del painter, vía el drawer de la puerta).
  for (const bad of ["AP.cube", "AP.spikes", "AP.socket", "AP.prop(", "AP.pillar", "AP.drone", "AP.flatWall", "AP.door(", "AP.doorHole"])
    assert.ok(!src.includes(bad), `render.js menciona ${bad} → debe dibujar TODO lo que tiene altura vía AP.drawAsset (roomShell/roomThings)`);
  for (const bucket of ["room.blocks", "room.sockets", "room.hazards"])
    assert.ok(!src.includes(bucket), `render.js itera ${bucket} → debe usar roomThings/roomShell`);
});

test("GUARDARRAÍL: physics.js NO enumera cubetas estáticas (sólidos genéricos por physics.solid)", () => {
  const src = readFileSync(new URL("../src/physics.js", import.meta.url), "utf8");
  for (const bucket of ["room.blocks", "room.sockets", "room.hazards"])
    assert.ok(!src.includes(bucket), `physics.js menciona ${bucket} → roomSolids debe leer roomThings + physics.solid`);
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
