/* =============================================================================
   gen-svg.mjs — genera SVGs FIELES de los assets fijos desde sus funciones reales.
   -----------------------------------------------------------------------------
   No dibuja a mano: pasa a AP.<fn> un "ctx grabador" que registra los polígonos que
   pinta la función (con tinta BLANCA → silueta neutra en grises) y emite un .svg. Como
   assets.js es puro (solo usa el ctx que le das), esto corre en NODE sin navegador.
   Uso:  node tools/gen-svg.mjs   → escribe assets/svg/*.svg e imprime el REGISTRO
   (minX,minY,w,h por asset) para pegar en src/assets.js (SPRITES).
   Solo cubre assets POLIGONALES (cubo, prop-cubo, prop-pirámide, pinchos, planta).
   ============================================================================= */
import { writeFileSync, readFileSync } from "node:fs";
import { AP } from "../src/assets.js";
import { POPT } from "../src/config.js";

const W = "#ffffff";   // tinta blanca → silueta neutra (grises = darken del juego)

/* ctx grabador (poligonal): registra trazados y emite SVG + bounding box. */
function recorder() {
  const paths = []; let cur = null;
  let fillStyle = "#000", strokeStyle = "#000", lineWidth = 1;
  const saved = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const see = (x, y) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  const flush = () => { if (cur && cur.pts.length && (cur.fill || cur.stroke)) paths.push(cur); cur = null; };
  const ctx = {
    beginPath() { flush(); cur = { pts: [], fill: null, stroke: null, lw: 1, closed: false }; },
    moveTo(x, y) { if (!cur) cur = { pts: [], fill: null, stroke: null, lw: 1, closed: false }; cur.pts.push([x, y]); see(x, y); },
    lineTo(x, y) { cur.pts.push([x, y]); see(x, y); },
    closePath() { if (cur) cur.closed = true; },
    fill() { if (cur) cur.fill = fillStyle; },
    stroke() { if (cur) { cur.stroke = strokeStyle; cur.lw = lineWidth; } },
    save() { saved.push([fillStyle, strokeStyle, lineWidth]); },
    restore() { const s = saved.pop(); if (s) { [fillStyle, strokeStyle, lineWidth] = s; } },
    // no-ops (los assets poligonales no los usan; presentes por seguridad)
    rect() {}, fillRect() {}, strokeRect() {}, arc() {}, ellipse() {}, bezierCurveTo() {}, roundRect() {}, clip() {}, translate() {},
  };
  Object.defineProperty(ctx, "fillStyle", { get: () => fillStyle, set: v => fillStyle = v });
  Object.defineProperty(ctx, "strokeStyle", { get: () => strokeStyle, set: v => strokeStyle = v });
  Object.defineProperty(ctx, "lineWidth", { get: () => lineWidth, set: v => lineWidth = v });
  Object.defineProperty(ctx, "lineJoin", { get: () => "", set: () => {} });
  Object.defineProperty(ctx, "lineCap", { get: () => "", set: () => {} });
  Object.defineProperty(ctx, "globalAlpha", { get: () => 1, set: () => {} });
  return {
    ctx,
    finish() {
      flush();
      const x0 = Math.floor(minX), y0 = Math.floor(minY), w = Math.ceil(maxX) - x0, h = Math.ceil(maxY) - y0;
      const r = n => Math.round(n * 100) / 100;
      const body = paths.map(P => {
        const d = "M" + P.pts.map((q, i) => (i ? "L" : "") + r(q[0]) + " " + r(q[1])).join(" ") + (P.closed ? " Z" : "");
        let a = `<path d="${d}" fill="${P.fill || "none"}"`;
        if (P.stroke) a += ` stroke="${P.stroke}" stroke-width="${P.lw}" stroke-linejoin="round"`;
        return a + "/>";
      }).join("\n  ");
      const svg = `<svg viewBox="${x0} ${y0} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">\n  ${body}\n</svg>\n`;
      return { svg, minX: x0, minY: y0, w, h };
    }
  };
}

const P = AP.projector(0, 0, POPT);   // origen 0,0 → bbox en espacio de proyección (delta-space)
const ASSETS = [
  { name: "cube",         label: "Cubo (bloque)",  draw: (c) => AP.cube(c, P, 0, 0, 0, W) },
  { name: "prop_cube",    label: "Prop cubo",      draw: (c) => AP.prop(c, P, 0, 0, 0, "cube", W) },
  { name: "prop_pyramid", label: "Prop pirámide",  draw: (c) => AP.prop(c, P, 0, 0, 0, "pyramid", W) },
  { name: "spikes",       label: "Pinchos",        draw: (c) => AP.spikes(c, P, 0, 0, 0, W) },
  { name: "plant",        label: "Planta",         draw: (c) => AP.plant(c, P, 0, 0, 0, W) },
];

const reg = {}, manifestEntries = [];
for (const a of ASSETS) {
  const rec = recorder();
  a.draw(rec.ctx);
  const { svg, minX, minY, w, h } = rec.finish();
  writeFileSync(new URL(`../assets/svg/${a.name}.svg`, import.meta.url), svg);
  reg[a.name] = { minX, minY, w, h };
  manifestEntries.push({ name: a.label, file: `${a.name}.svg`, w, h });
}

// Manifiesto: MERGE con el existente (por `file`) para no pisar entradas manuales (p. ej. example.svg).
const manifestURL = new URL("../assets/svg/manifest.json", import.meta.url);
let prev = [];
try { prev = JSON.parse(readFileSync(manifestURL, "utf8")); } catch {}
const byFile = new Map(prev.map(e => [e.file, e]));
for (const e of manifestEntries) byFile.set(e.file, e);
writeFileSync(manifestURL, JSON.stringify([...byFile.values()], null, 2) + "\n");

console.log("SVG generados + manifest.json actualizado.");
console.log("REGISTRO (pegar en src/assets.js → SPRITES):");
console.log(JSON.stringify(reg, null, 2));
