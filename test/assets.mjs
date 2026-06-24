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

test("anclaje 'center' centra la huella; 'corner' la deja en (0,0)", () => {
  // corner (estructura): floor ⇒ ref en (0,0,0) y caja en (0,0)
  assert.deepEqual(assetRef("floor"), { x: 0, y: 0, z: 0 });
  assert.deepEqual(assetBox("floor"), { x: 0, y: 0, z: 0, w: 1, l: 1, h: 0 });
  // center (objetos): cube ⇒ ref en (0.5,0.5,0) (1×1 centrado = misma caja [0,1]); spikes ⇒ huella centrada
  assert.deepEqual(assetRef("cube"), { x: 0.5, y: 0.5, z: 0 });
  assert.deepEqual(assetBox("cube"), { x: 0, y: 0, z: 0, w: 1, l: 1, h: 1 });
  const s = assetBox("spikes"); assert.ok(Math.abs(s.x - (0.5 - s.w / 2)) < 1e-9);
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

test("manifest.json NO diverge del registro (w/h de sprites y de tiles de pared)", () => {
  const manifest = JSON.parse(readFileSync(new URL("../assets/svg/manifest.json", import.meta.url), "utf8"));
  const byFile = new Map(manifest.map(e => [e.file, e]));
  for (const [id, a] of Object.entries(ASSETS)) {
    const file = a.files && a.files.svg; if (!file) continue;
    const e = byFile.get(file); if (!e) continue;                 // ficheros sin entrada en manifest: se ignoran
    const dim = a.sprite || a.tile;                                // sprite (anclado) o tile (pared)
    if (!dim) continue;
    assert.equal(e.w, dim.w, `manifest ${file}.w (=${e.w}) ≠ registro (=${dim.w})`);
    assert.equal(e.h, dim.h, `manifest ${file}.h (=${e.h}) ≠ registro (=${dim.h})`);
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
test("tools/tool-assets.html no contiene mapas de geometría hardcodeada (GU/BOX/REF/box*)", () => {
  const html = readFileSync(new URL("../tools/tool-assets.html", import.meta.url), "utf8");
  for (const bad of [/\bconst\s+GU\s*=/, /\bconst\s+BOX\s*=/, /\bconst\s+REF\s*=/,
                     /\bconst\s+boxProp\s*=/, /\bconst\s+boxSocket\s*=/, /\bconst\s+guProp\s*=/, /\bconst\s+guSocket\s*=/])
    assert.ok(!bad.test(html), `la tool reintrodujo un mapa de geometría: ${bad}`);
  // tampoco debería importar la geometría desde config (su hogar es data/assets.js)
  assert.ok(!/from\s+["']\.\.\/src\/config\.js["'][^\n]*\b(PROP|ROBOT|DOOR|SOCKET|WALL_H)\b/.test(html),
    "la tool importa geometría desde config.js en vez de data/assets.js");
});

test("GUARDARRAÍL: render.js NO dibuja assets colocables por nombre (motor de dibujo genérico)", () => {
  const src = readFileSync(new URL("../src/render.js", import.meta.url), "utf8");
  // Permitido: AP.floor/flatWall/door (cáscara estructural), AP.drawAsset (genérico), AP.drawSprite (icono HUD).
  for (const bad of ["AP.cube", "AP.spikes", "AP.socket", "AP.prop(", "AP.pillar", "AP.drone"])
    assert.ok(!src.includes(bad), `render.js menciona ${bad} → debe dibujar lo colocable vía AP.drawAsset`);
  for (const bucket of ["room.blocks", "room.sockets", "room.hazards"])
    assert.ok(!src.includes(bucket), `render.js itera ${bucket} → debe usar roomThings`);
});

test("GUARDARRAÍL: physics.js NO enumera cubetas estáticas (sólidos genéricos por physics.solid)", () => {
  const src = readFileSync(new URL("../src/physics.js", import.meta.url), "utf8");
  for (const bucket of ["room.blocks", "room.sockets", "room.hazards"])
    assert.ok(!src.includes(bucket), `physics.js menciona ${bucket} → roomSolids debe leer roomThings + physics.solid`);
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
