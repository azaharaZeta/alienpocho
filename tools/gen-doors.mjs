/* Generador del arte de la PUERTA (door.svg, un solo dibujo; front/back comparten imagen).
   La puerta = 3 cajas iso del engine (poste izq + poste dcho + dintel) con el MISMO
   sombreado que box(): techo #fff, cara +x = darken(0.62)=158, cara +y = darken(0.82)=209,
   contornos negros, + ranuras horizontales (línea blanca + negra) que recorren las dos caras
   frontales. Proyección idéntica a la del juego (TW=34,TH=17,BH=17). Se autogenera desde la
   GEOMETRÍA del registro (data/assets.js DOOR) → cambiar SPAN_HALF/POST_W aquí no hace falta.
   Uso: node tools/gen-doors.mjs   (escribe door.svg y reporta los tiles front/back para ASSETS.door.tiles). */
import { writeFileSync } from "node:fs";
import { DOOR, WALL_H } from "../src/data/assets.js";

const TW = 34, TH = 17, BH = 17;
const P = (x, y, z) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * BH });
const r2 = n => +n.toFixed(2);
const pt = p => `${r2(p.x)} ${r2(p.y)}`;

const { POST_W, LINTEL_H, T, SPAN_HALF } = DOOR;
const W = 2 * SPAN_HALF;                 // ancho total de la puerta (celdas)

// Ranuras (constantes en z; independientes del ancho): postes y dintel.
const POST_SLATS = [0.81, 1.53, 2.25], LINTEL_SLATS = [2.67], SLAT_DROP = 0.03;

function quad(p, fill) { return `  <polygon points="${p.map(pt).join(" ")}" fill="${fill}" stroke="#000000" stroke-width="1" stroke-linejoin="round"/>`; }
function line(p, stroke) { return `  <polyline points="${p.map(pt).join(" ")}" fill="none" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>`; }

// Una caja (poste/dintel): caras techo/+x/+y + ranuras. y0<y1 (profundidad). Devuelve [svgStrings], y acumula pts.
function bar(x0, y0, x1, y1, z0, z1, slats, acc) {
  const A=P(x0,y0,z1),B=P(x1,y0,z1),C=P(x1,y1,z1),D=P(x0,y1,z1);
  const Bb=P(x1,y0,z0),Cb=P(x1,y1,z0),Db=P(x0,y1,z0);
  for (const p of [A,B,C,D,Bb,Cb,Db]) acc.push(p);
  const out = [ quad([A,B,C,D],"#ffffff"), quad([B,C,Cb,Bb],"rgb(158,158,158)"), quad([D,C,Cb,Db],"rgb(209,209,209)") ];
  for (const z of slats) {                         // ranura: recorre cara +x y +y a la altura z
    const w=[P(x1,y0,z),P(x1,y1,z),P(x0,y1,z)], b=[P(x1,y0,z-SLAT_DROP),P(x1,y1,z-SLAT_DROP),P(x0,y1,z-SLAT_DROP)];
    out.push(line(w,"rgb(255,255,255)"), line(b,"#000000"));
  }
  return out;
}

function door(variant) {
  const [y0, y1] = variant === "back" ? [-T, 0] : [0, T];   // fondo entra (-y); frente protruye (+y)
  const acc = [], parts = [];
  parts.push(...bar(0, y0, POST_W, y1, 0, WALL_H, POST_SLATS, acc));            // poste izq
  parts.push(...bar(W - POST_W, y0, W, y1, 0, WALL_H, POST_SLATS, acc));        // poste dcho
  parts.push(...bar(0, y0, W, y1, WALL_H - LINTEL_H, WALL_H, LINTEL_SLATS, acc)); // dintel
  const xs = acc.map(p=>p.x), ys = acc.map(p=>p.y);
  const minX = Math.floor(Math.min(...xs)), maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
  const w = maxX - minX, h = maxY - minY;
  const svg = `<svg viewBox="${minX} ${minY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">\n${parts.join("\n")}\n</svg>\n`;
  return { svg, tile: { w, h, minX, minY } };
}

// UN solo sprite (door.svg): front y back son el MISMO dibujo, solo cambia el ancla. Escribimos el front
// (canónico) y reportamos los DOS offsets para ASSETS.door.tiles (front protruye, back retrocede por T).
const front = door("front"), back = door("back");
writeFileSync(new URL("../assets/svg/door.svg", import.meta.url), front.svg);
const fmt = t => `{ w: ${t.w}, h: ${t.h}, minX: ${t.minX}, minY: ${t.minY} }`;
console.log(`door.svg  ->  ASSETS.door.tiles.front = ${fmt(front.tile)}`);
console.log(`          +   ASSETS.door.tiles.back  = ${fmt(back.tile)}`);
