/* =============================================================================
   gen-walls.mjs — TIRAS de pared (panal) como SVG YA EN PERSPECTIVA (cizalladas).
   -----------------------------------------------------------------------------
   La pared tiene altura FIJA (3 u) y se tesela en HORIZONTAL. A diferencia de antes,
   el SVG NO es plano: los hexágonos se PROYECTAN a la perspectiva iso aquí (con la misma
   P del juego, eje x, fixed=0, origen 0,0) y se recortan al PARALELOGRAMO de la tira. El
   juego solo BLITTEA la tira teselada (sin transform); para el muro del eje y la voltea.
   - Hexágonos POINTY-TOP con ancho = ancho COMPLETO de la celda (N tiles): wall1 N=1, wall2 N=2.
     (Pointy-top tesela con período = ancho de hex = N tiles, justo lo pedido.)
   - Corte arriba: la punta superior de la fila de arriba cae en z=3 (no asoma hex por encima).
   Uso:  node tools/gen-walls.mjs   → escribe wall1.svg, wall2.svg e imprime el REGISTRO.
   ============================================================================= */
import { writeFileSync } from "node:fs";

const TW2 = 17, TH2 = 8.5, BH = 17, Hh = 3;   // proyección del juego (TILE_W/2, TILE_H/2, BLOCK_H), alto 3
const P = (a, z) => [TW2 * a, TH2 * a - BH * z];   // eje x, fixed=0, origen (0,0)
const r2 = n => Math.round(n * 100) / 100;
const pts = arr => arr.map(p => r2(p[0]) + "," + r2(p[1])).join(" ");

const VARIANTS = [{ name: "wall1", N: 1 }, { name: "wall2", N: 2 }];
const reg = {};

for (const v of VARIANTS) {
  const N = v.N, aH = N / 2, Rz = N / Math.sqrt(3), rowS = 1.5 * Rz;   // semiancho=N/2; hex pointy-top
  // hexágono pointy-top centrado en (ac,zc), en coords de cara (a,z), proyectado:
  const hex = (ac, zc) => pts([
    P(ac, zc + Rz), P(ac + aH, zc + Rz / 2), P(ac + aH, zc - Rz / 2),
    P(ac, zc - Rz), P(ac - aH, zc - Rz / 2), P(ac - aH, zc + Rz / 2),
  ]);
  const hexes = [];
  for (let r = 0, zc = Hh - Rz; zc + Rz > -0.2; r++, zc -= rowS) {
    const off = (r & 1) ? aH : 0;                 // filas impares desplazadas medio ancho
    if (off === 0) { hexes.push(hex(0, zc)); hexes.push(hex(N, zc)); }   // bordes (mitades por wrap)
    else hexes.push(hex(aH, zc));                  // centrada
  }
  // paralelogramo de la tira (BL,BR,TR,TL) y su bbox
  const para = [P(0, 0), P(N, 0), P(N, Hh), P(0, Hh)];
  const xs = para.map(p => p[0]), ys = para.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.ceil(Math.max(...xs) - minX), h = Math.ceil(Math.max(...ys) - minY);
  const svg =
`<svg viewBox="${r2(minX)} ${r2(minY)} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="w"><polygon points="${pts(para)}"/></clipPath></defs>
  <g clip-path="url(#w)">
    <polygon points="${pts(para)}" fill="#000000"/>
    <g fill="#ffffff" stroke="#000000" stroke-width="1" stroke-linejoin="round">
${hexes.map(p => `      <polygon points="${p}"/>`).join("\n")}
    </g>
  </g>
</svg>
`;
  writeFileSync(new URL(`../assets/svg/${v.name}.svg`, import.meta.url), svg);
  reg[v.name] = { N, w, h, minX: Math.round(minX), minY: Math.round(minY) };
  console.log(`${v.name}.svg  (${w}×${h}, N=${N}, minX=${Math.round(minX)}, minY=${Math.round(minY)})`);
}
console.log("REGISTRO (para assets.js → WALL_TILES):");
console.log(JSON.stringify(reg, null, 2));
