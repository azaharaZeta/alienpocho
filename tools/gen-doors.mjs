/* =============================================================================
   gen-doors.mjs — MARCO de puerta como SVG YA EN PERSPECTIVA (desde AP.door, fiel).
   -----------------------------------------------------------------------------
   La puerta tiene altura FIJA (3) y vano fijo (2·SPAN_HALF). Se genera proyectando el
   MARCO real (2 postes + dintel + ranuras) con un ctx grabador sobre AP.door (frame, sin
   hueco). El vano queda TRANSPARENTE → en el juego, al cruzar, el robot se ve a través
   (los postes lo tapan, el vano no). Dos variantes por el GROSOR del marco:
     - door_front: marco hacia fuera del borde (puertas del frente; vano abierto).
     - door_back : marco del muro de fondo (se le añade en juego el hueco negro detrás).
   El eje y se obtiene volteando en horizontal (igual que la pared). Corre en Node (assets.js puro).
   Uso:  node tools/gen-doors.mjs
   ============================================================================= */
import { writeFileSync } from "node:fs";
import { AP } from "../src/assets.js";
import { POPT, DOOR } from "../src/config.js";

function recorder() {   // ctx grabador poligonal (igual criterio que tools/gen-svg.mjs)
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
    rect() {}, fillRect() {}, strokeRect() {}, arc() {}, ellipse() {}, bezierCurveTo() {}, roundRect() {}, clip() {}, translate() {},
  };
  Object.defineProperty(ctx, "fillStyle", { get: () => fillStyle, set: v => fillStyle = v });
  Object.defineProperty(ctx, "strokeStyle", { get: () => strokeStyle, set: v => strokeStyle = v });
  Object.defineProperty(ctx, "lineWidth", { get: () => lineWidth, set: v => lineWidth = v });
  Object.defineProperty(ctx, "lineJoin", { get: () => "", set: () => {} });
  Object.defineProperty(ctx, "lineCap", { get: () => "", set: () => {} });
  Object.defineProperty(ctx, "globalAlpha", { get: () => 1, set: () => {} });
  return { ctx, finish() {
    flush();
    const x0 = Math.floor(minX), y0 = Math.floor(minY), w = Math.ceil(maxX) - x0, h = Math.ceil(maxY) - y0;
    const r = n => Math.round(n * 100) / 100;
    const body = paths.map(P => {
      const d = "M" + P.pts.map((q, i) => (i ? "L" : "") + r(q[0]) + " " + r(q[1])).join(" ") + (P.closed ? " Z" : "");
      let a = `<path d="${d}" fill="${P.fill || "none"}"`;
      if (P.stroke) a += ` stroke="${P.stroke}" stroke-width="${P.lw}" stroke-linejoin="round" stroke-linecap="round"`;
      return a + "/>";
    }).join("\n  ");
    return { svg: `<svg viewBox="${x0} ${y0} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">\n  ${body}\n</svg>\n`, x0, y0, w, h };
  } };
}

const SPAN = 2 * DOOR.SPAN_HALF;       // ancho del vano (de extremo a extremo del marco)
const W = "#ffffff", Hh = 3;
const P0 = AP.projector(0, 0, POPT);   // eje x, origen (0,0)

function gen(name, fixed) {
  const rec = recorder();
  AP.door(rec.ctx, P0, "x", fixed, 0, SPAN, Hh, W, false);   // SOLO marco (sin hueco)
  const { svg, x0, y0, w, h } = rec.finish();
  writeFileSync(new URL(`../assets/svg/${name}.svg`, import.meta.url), svg);
  const ref = P0(0, fixed, 0);          // referencia: esquina del vano a0=0 en el borde
  return { name, w, h, minX: Math.round(x0 - ref.x), minY: Math.round(y0 - ref.y) };
}

const reg = { door_front: gen("door_front", 1), door_back: gen("door_back", 0) };
console.log("REGISTRO (para assets.js → DOOR_TILES):");
console.log(JSON.stringify(reg, null, 2));
