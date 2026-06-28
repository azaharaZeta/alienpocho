/* =============================================================================
   ALIEN POCHO — TESTS DEL PAINTER (test/painter.mjs)
   -----------------------------------------------------------------------------
   Oráculo de INVARIANTE para `ENGINE.depthSort` (orden de pintado isométrico).
   Verifica las dos propiedades que debe cumplir el painter:

     (1) CORRECCIÓN (escenas sin ciclo): para todo par de cajas que se SOLAPAN en
         pantalla y tienen un orden de oclusión INEQUÍVOCO (exactamente una está
         "delante" por separación de ejes), el painter debe pintar la de detrás
         ANTES. Si el grafo de esas relaciones es acíclico, NO debe haber NINGUNA
         violación. (Para escenas con ciclo real no se puede exigir 0 violaciones:
         ningún orden las satisface — solo se exige determinismo y daño acotado.)

     (2) DETERMINISMO: el orden devuelto es función del CONJUNTO de cajas, no del
         orden en que llegan. Permutar la entrada NO cambia el resultado visual.
         (Si el orden dependiera de la inserción → parpadeo/pop al permutar la entrada.)

   Ejecutar:  node test/painter.mjs   (lo encadena `npm test`).
   ============================================================================= */
import assert from "node:assert/strict";
import { ENGINE } from "../src/engine.js";

const POPT = { TILE_W: 34, TILE_H: 17, BLOCK_H: 17 };
const p = ENGINE.projector(0, 0, POPT);
const E = 1e-6;

/* ---- mini-runner sin dependencias (igual estilo que smoke.mjs) ---- */
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ✓ " + name); passed++; }
  catch (e) { console.error("  ✗ " + name + "\n      " + e.message); failed++; }
}

/* ---- geometría de referencia (INDEPENDIENTE del motor) ---- */
// Silueta iso (hexágono) de la caja: extensiones en los TRES ejes del hexágono (la vertical de pantalla
// + las dos diagonales). Dos siluetas se solapan EN PANTALLA sii se solapan en los tres ejes (exacto;
// mismo criterio que engine.depthSort, re-implementado aquí para que el oráculo sea autónomo).
function silhouette(b) {
  const { TILE_H: TH, BLOCK_H: BH } = POPT;
  return {
    a0: b.x0 - b.y1,           a1: b.x1 - b.y0,
    b0: BH * b.z0 - TH * b.y1, b1: BH * b.z1 - TH * b.y0,
    c0: TH * b.x0 - BH * b.z1, c1: TH * b.x1 - BH * b.z0,
  };
}
function overlapScr(a, b) {
  const A = silhouette(a), B = silhouette(b);
  return A.a0 < B.a1 && A.a1 > B.a0 && A.b0 < B.b1 && A.b1 > B.b0 && A.c0 < B.c1 && A.c1 > B.c0;
}
// ¿`a` está en el lado CERCANO a cámara de `b` por algún eje? (a ocluiría a b)
function nearVia(a, b) {
  return a.x0 >= b.x1 - E || a.y0 >= b.y1 - E || a.z0 >= b.z1 - E;
}
// Relación de oclusión INEQUÍVOCA entre a y b: 'a-front' | 'b-front' | 'none'.
// 'none' = ni se separan, o se separan en sentidos contradictorios (ambiguo).
function relation(a, b) {
  const af = nearVia(a, b), bf = nearVia(b, a);
  if (af && !bf) return "a-front";
  if (bf && !af) return "b-front";
  return "none";
}

/* ---- grafo de relaciones inequívocas (solo pares que solapan en pantalla) ---- */
// edge u->v  ⇔  u debe pintarse ANTES que v (u está detrás de v).
function buildGraph(boxes) {
  const n = boxes.length, adj = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlapScr(boxes[i], boxes[j])) continue;
    const r = relation(boxes[i], boxes[j]);
    if (r === "a-front") adj[j].add(i);        // i detrás → i antes que j
    else if (r === "b-front") adj[i].add(j);   // j detrás → j antes que i  ... (i antes que j)
  }
  return adj;
}
// Gate LAXO histórico (AABB de pantalla) — SOLO para el test que demuestra que el hexagonal es estricto.
// Mismo grafo que buildGraph pero con solape por rectángulo proyectado (el que añade el eje espurio).
function overlapAABB(a, b) {
  const { TILE_W: TW, TILE_H: TH, BLOCK_H: BH } = POPT;
  const A = { x0: (a.x0 - a.y1) * TW / 2, x1: (a.x1 - a.y0) * TW / 2, y0: (a.x0 + a.y0) * TH / 2 - a.z1 * BH, y1: (a.x1 + a.y1) * TH / 2 - a.z0 * BH };
  const B = { x0: (b.x0 - b.y1) * TW / 2, x1: (b.x1 - b.y0) * TW / 2, y0: (b.x0 + b.y0) * TH / 2 - b.z1 * BH, y1: (b.x1 + b.y1) * TH / 2 - b.z0 * BH };
  return A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0;
}
function buildGraphAABB(boxes) {
  const n = boxes.length, adj = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlapAABB(boxes[i], boxes[j])) continue;
    const r = relation(boxes[i], boxes[j]);
    if (r === "a-front") adj[j].add(i);
    else if (r === "b-front") adj[i].add(j);
  }
  return adj;
}
function hasCycle(adj) {
  const n = adj.length, st = new Array(n).fill(0);
  const dfs = (u) => {
    st[u] = 1;
    for (const v of adj[u]) { if (st[v] === 1) return true; if (st[v] === 0 && dfs(v)) return true; }
    st[u] = 2; return false;
  };
  for (let i = 0; i < n; i++) if (st[i] === 0 && dfs(i)) return true;
  return false;
}
// Violaciones del orden de salida frente a las relaciones inequívocas.
function violations(seq) {
  const out = [];
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
    if (!overlapScr(seq[i], seq[j])) continue;
    // seq[i] se pinta antes; si está DELANTE de seq[j], es una violación (tapa mal).
    if (relation(seq[i], seq[j]) === "a-front")
      out.push(`${seq[i].tag} (delante) se pinta antes que ${seq[j].tag}`);
  }
  return out;
}

/* ---- helpers de cajas ---- */
let _id = 0;
function box(x0, y0, z0, x1, y1, z1, tag) { return { x0, y0, z0, x1, y1, z1, tag: tag ?? "b" + (_id++) }; }
function geomSeq(arr) { return arr.map(b => `${b.x0},${b.y0},${b.z0},${b.x1},${b.y1},${b.z1}`).join("|"); }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// PRNG determinista (mulberry32) → fuzz reproducible.
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log("ALIEN POCHO — painter tests\n");

/* --------------------------------------------------------- BÁSICO + NO-PÉRDIDA --- */
test("no pierde ni duplica cajas", () => {
  const bs = [box(0, 0, 0, 1, 1, 1), box(2, 2, 0, 3, 3, 1), box(1, 1, 1, 2, 2, 2)];
  const out = ENGINE.depthSort(bs, p);
  assert.equal(out.length, bs.length);
  assert.deepEqual(new Set(out), new Set(bs), "mismas cajas, sin perder");
});

test("la caja de detrás se pinta primero (caso canónico de smoke)", () => {
  const A = box(0, 0, 0, 1, 1, 1, "A"), B = box(1, 1, 0, 2, 2, 1, "B");
  const out = ENGINE.depthSort([B, A], p).map(b => b.tag);
  assert.deepEqual(out, ["A", "B"]);
});

/* ----------------------------------------------- CORRECCIÓN (escenas acíclicas) --- */
test("apilado vertical: el bloque bajo se pinta antes que el de encima", () => {
  const lo = box(0, 0, 0, 1, 1, 1, "lo"), hi = box(0, 0, 1, 1, 1, 2, "hi");
  const out = ENGINE.depthSort([hi, lo], p).map(b => b.tag);
  assert.deepEqual(out, ["lo", "hi"]);
});

test("fila en x: se pintan de atrás (−x) a delante (+x)", () => {
  const a = box(0, 0, 0, 1, 1, 1, "a"), b = box(1, 0, 0, 2, 1, 1, "b"), c = box(2, 0, 0, 3, 1, 1, "c");
  const out = ENGINE.depthSort([c, a, b], p).map(x => x.tag);
  assert.deepEqual(out, ["a", "b", "c"]);
});

/* ---------------------------------------------------------------- DETERMINISMO --- */
test("determinismo: permutar la entrada NO cambia el orden visual (casos de ciclo del audit)", () => {
  // Ciclos REALES entre cajas que SÍ solapan en pantalla (el painter debe ordenarlas determinista).
  const escenas = [
    [box(2, 2, 1, 5, 5, 3), box(0, 3, 4, 3, 4, 5), box(0, 4, 2, 2, 7, 3)],
    [box(0, 0, 1, 2, 3, 2), box(2, 0, 1, 5, 1, 4), box(1, 2, 0, 4, 4, 1)],
    // realista: robot sobre bloque + objeto en alto + bloque suelo
    [box(3, 3, 0, 4, 4, 1), box(2.63, 2.9, 1, 3.27, 3.54, 2.5), box(2.44, 3.56, 1, 3, 4.12, 1.5)],
  ];
  const r = rng(12345);
  for (const esc of escenas) {
    const ref = geomSeq(ENGINE.depthSort(esc, p));
    for (let k = 0; k < 40; k++) {
      const got = geomSeq(ENGINE.depthSort(shuffle(esc, r), p));
      assert.equal(got, ref, "el orden debe ser independiente de la permutación de entrada");
    }
  }
});

/* ----------------------------------------- GATE EXACTO: hexágono ≠ AABB de pantalla --- */
// A flota sobre B sin TOCARLA en pantalla, pero sus rectángulos proyectados (AABB) SÍ se solapan →
// arista espuria A→B que, junto a las reales A·C y B·C, cierra un ciclo FALSO. El gate AABB cae en el
// rompe-ciclos y pinta "B antes que C" (B está DELANTE de C → la tapa mal). Por silueta hexagonal el
// par A·B no se toca → es ACÍCLICA y el painter da el orden correcto atrás→adelante: A, C, B.
// Con el gate AABB (laxo) este test caería (violación); con el hexagonal pasa.
test("gate hexagonal: lo que el AABB ve cíclico es acíclico y se pinta sin violar oclusión", () => {
  const esc = [box(2, 0, 3, 5, 2, 4, "A"), box(3, 1, 1, 5, 4, 2, "B"), box(1, 2, 1, 3, 5, 4, "C")];
  assert.ok(hasCycle(buildGraphAABB(esc)), "el gate AABB (laxo) ve un ciclo falso");
  assert.ok(!hasCycle(buildGraph(esc)), "por silueta hexagonal NO hay ciclo");
  assert.deepEqual(ENGINE.depthSort(esc, p).map(b => b.tag), ["A", "C", "B"], "orden correcto atrás→adelante");
  assert.equal(violations(ENGINE.depthSort(esc, p)).length, 0, "el painter no viola la oclusión");
});

/* -------------------------------------------------------------------- FUZZ --- */
test("FUZZ 30k escenas: determinismo SIEMPRE + 0 violaciones cuando es acíclico", () => {
  const r = rng(0xA11CE);
  let cyclic = 0, acyclic = 0;
  for (let it = 0; it < 30000; it++) {
    const n = 2 + Math.floor(r() * 4);                       // 2..5 cajas
    const bs = [];
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * 5), y = Math.floor(r() * 5), z = Math.floor(r() * 4);
      const sx = 1 + Math.floor(r() * 3), sy = 1 + Math.floor(r() * 3), sz = 1 + Math.floor(r() * 3);
      bs.push(box(x, y, z, x + sx, y + sy, z + sz, "B" + i));
    }
    // (1) DETERMINISMO: siempre.
    const ref = geomSeq(ENGINE.depthSort(bs, p));
    const perm = geomSeq(ENGINE.depthSort(shuffle(bs, r), p));
    assert.equal(perm, ref, `no determinista en it=${it}`);
    // (2) CORRECCIÓN: si el grafo de relaciones inequívocas es acíclico, 0 violaciones.
    const adj = buildGraph(bs);
    const seq = ENGINE.depthSort(bs, p);
    if (hasCycle(adj)) { cyclic++; }
    else { acyclic++; const v = violations(seq); assert.equal(v.length, 0, `violación en escena acíclica it=${it}: ${v[0]}`); }
  }
  console.log(`      (acíclicas: ${acyclic}, cíclicas: ${cyclic})`);
  assert.ok(acyclic > 0 && cyclic > 0, "el fuzz debe cubrir ambos tipos de escena");
});

/* --------------------------------------------------------------- RESUMEN --- */
console.log(`\n${passed} pasados, ${failed} fallidos`);
process.exit(failed ? 1 : 0);
