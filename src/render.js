/* =============================================================================
   ALIEN POCHO — RENDER de escena + HUD (render.js)
   -----------------------------------------------------------------------------
   Pinta la sala: suelo, paredes/puertas, y objetos+entidades ordenados por
   profundidad (painter de engine.js), más el HUD, el minimapa cenital y el banner
   de victoria. Lee el estado de game.js y dibuja con las primitivas de draw.js.
   Expone render(room); lo llama el bucle (main.js) cada frame.
   ============================================================================= */
"use strict";

import { CFG, WALL_H } from "./config.js";
import { ENGINE } from "./engine.js";
import { AP } from "./draw.js";
import { roomThings } from "./world.js";          // lista uniforme de placements
import { assetTint, propAsset } from "./data/assets.js";   // tinte por asset; mapeo forma→asset del icono HUD
import { ctx, P, setProjector, applyRoomTheme } from "./view.js";
import { entities } from "./player.js";
import { game, world, room } from "./game.js";

let _themeRoom = null;

export function render(room) {
  if (room !== _themeRoom) { applyRoomTheme(room); _themeRoom = room; }
  setProjector(room);                     // proyector centrado para esta sala
  ctx.fillStyle = CFG.COL.bg;
  ctx.fillRect(0, 0, CFG.W, CFG.H);

  const ink = room.ink, ink2 = room.ink2 || ink, WH = WALL_H, D = AP.DOOR;   // WH: altura de pared (config.js)
  const doorSpan = (n) => [n / 2 - AP.DOOR.SPAN_HALF, n / 2 + AP.DOOR.SPAN_HALF]; // vano centrado en el borde

  // 1) Suelo (plano en z=0; nunca ocluye, se pinta al fondo)
  for (let y = 0; y < room.h; y++)
    for (let x = 0; x < room.w; x++)
      AP.floor(ctx, P, x, y, ink);

  // 1b) Paredes/puertas del FONDO (siempre detrás de todo)
  AP.flatWall(ctx, P, "x", 0, 0, room.w, WH, ink, room.wallTile);        // borde y=0 (atrás-dcha)
  if (room.exits.ym) { const [s0, s1] = doorSpan(room.w); AP.door(ctx, P, "x", 0, s0, s1, WH, ink, true); }
  AP.flatWall(ctx, P, "y", 0, 0, room.h, WH, ink, room.wallTile);        // borde x=0 (atrás-izq)
  if (room.exits.xm) { const [s0, s1] = doorSpan(room.h); AP.door(ctx, P, "y", 0, s0, s1, WH, ink, true); }

  // 2) Lo COLOCABLE como cajas para el painter — genérico: itera la lista uniforme de la sala
  //    y por cada placement usa su caja (aabb) + su drawer (AP.drawAsset).
  const draws = [];
  const box3 = (x0, y0, z0, x1, y1, z1, draw) => draws.push({ x0, y0, z0, x1, y1, z1, draw });

  for (const t of roomThings(room)) {
    const col = assetTint(t.asset) === "secondary" ? ink2 : ink;
    const a = t.aabb;
    box3(a.x0, a.y0, a.z0, a.x1, a.y1, a.z1, () => AP.drawAsset(ctx, P, t, col));
  }

  // entidades (jugador, etc.): cada una añade su caja al orden.
  for (const e of entities) e.addDraws(draws, room);

  // puertas del FRENTE: el MARCO entra en el painter como UNA caja a lo largo del borde; el robot,
  // al cruzar, se intercala solo (los postes lo tapan, el vano lo deja ver). hole=false → marco frontal.
  if (room.exits.yp) {
    const [s0, s1] = doorSpan(room.w), h = room.h;
    box3(s0, h, 0, s1, h + D.T, WH, () => AP.door(ctx, P, "x", h, s0, s1, WH, ink, false));
  }
  if (room.exits.xp) {
    const [s0, s1] = doorSpan(room.h), w = room.w;
    box3(w, s0, 0, w + D.T, s1, WH, () => AP.door(ctx, P, "y", w, s0, s1, WH, ink, false));
  }

  // 3) Ordenar topológicamente y pintar
  for (const it of ENGINE.depthSort(draws, P)) it.draw();

  drawHUD();
  drawMinimap();
  if (game.won) drawWinBanner();
}

/* Banner de victoria */
function drawWinBanner() {
  const ink = room.ink, ink2 = room.ink2 || ink;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, CFG.H / 2 - 22, CFG.W, 44);
  ctx.fillStyle = ink2;   // título en secundario
  ctx.font = "14px 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("¡MISION COMPLETA!", CFG.W / 2, CFG.H / 2 - 4);
  ctx.fillStyle = ink; ctx.font = "8px 'Courier New', monospace";   // subtítulo en primario
  ctx.fillText("pulsa un boton para volver a jugar", CFG.W / 2, CFG.H / 2 + 12);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
}

/* --- Helpers de HUD --- */
// Barra vertical segmentada (las "esquineras" del marco original Alien 8)
function drawSegBar(cx, y0, y1, col) {
  ctx.fillStyle = col || CFG.COL.hud;
  for (let y = y0; y < y1; y += 6) ctx.fillRect(cx - 3, y, 6, 4);
}
// Casilla del objeto que llevas: marco cuadrado centrado en (cx,cy); si hay objeto,
// se dibuja centrado y RECORTADO dentro del marco (sea cual sea su forma).
function drawCarrySlot(cx, cy, shape, frameCol, circuitCol) {
  const s = 9;                                    // semilado del marco
  ctx.strokeStyle = frameCol; ctx.lineWidth = 1;
  ctx.strokeRect(cx - s + 0.5, cy - s + 0.5, s * 2 - 1, s * 2 - 1);
  if (!shape) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - s + 1, cy - s + 1, s * 2 - 2, s * 2 - 2); ctx.clip();
  AP.drawSprite(propAsset(shape), ctx, { x: cx, y: cy + 4 }, circuitCol);   // mismo sprite, anclado a un punto de pantalla
  ctx.restore();
}
// Mini robot (icono de vidas) en estilo línea, centrado en (cx,cy).
function drawMiniRobot(cx, cy, col) {
  col = col || CFG.COL.hud;
  const w = 12, h = 9.5, x = cx - w / 2, yTop = cy - h / 2;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = 1.1; ctx.lineJoin = "round"; ctx.lineCap = "round";
  // antena + bolita
  ctx.beginPath(); ctx.moveTo(cx, yTop); ctx.lineTo(cx, yTop - 3); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, yTop - 3.8, 1.05, 0, Math.PI * 2); ctx.fill();
  // cabeza (contorno redondeado)
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, yTop, w, h, 2.6); else ctx.rect(x, yTop, w, h);
  ctx.stroke();
  // ojos
  ctx.beginPath(); ctx.arc(cx - 3, cy + 0.5, 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3, cy + 0.5, 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/* MINIMAPA: visión cenital. Cada sala es su rectángulo w×h en coords de mundo (wx,wy),
   a escala fija, centrado en la sala actual; se recorta al viewport. */
// Sala ancha (w>h) → mapa a la DERECHA; alta o cuadrada → a la IZQUIERDA (zona libre del HUD).
function minimapOnRight() { return room.w > room.h; }

function drawMinimap() {
  if (room.wx === undefined) return;
  const ink = room.ink, ink2 = room.ink2 || ink;
  const MM = 45, oy = 18;                   // viewport cuadrado (oy deja hueco al nombre encima)
  const ox = minimapOnRight() ? (CFG.W - MM - 8) : 8;
  const WS = 26, sc = MM / WS, INS = 0.6;   // INS: medio hueco entre salas (= pared)
  const ccx = room.wx + room.w / 2, ccy = room.wy + room.h / 2;   // centro de la sala actual
  const toX = wx => ox + MM / 2 + (wx - ccx) * sc, toY = wy => oy + MM / 2 + (wy - ccy) * sc;
  // fondo + marco
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(ox - 4, oy - 4, MM + 8, MM + 8);
  ctx.strokeStyle = ENGINE.darken(ink, 0.5); ctx.lineWidth = 1;
  ctx.strokeRect(ox - 3.5, oy - 3.5, MM + 7, MM + 7);
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, MM, MM); ctx.clip();
  // salas como rectángulos; el INSET deja un hueco negro entre vecinas = pared única
  for (const k of Object.keys(world.rooms)) {
    const Rm = world.rooms[k]; if (Rm.wx === undefined) continue;
    ctx.fillStyle = (Rm === room) ? ink2 : ENGINE.darken(ink, 0.32);
    ctx.fillRect(toX(Rm.wx) + INS, toY(Rm.wy) + INS, Rm.w * sc - 2 * INS, Rm.h * sc - 2 * INS);
  }
  // PUERTAS en secundario (una marca por conexión: lados xp/yp para no duplicar)
  ctx.fillStyle = ink2;
  for (const k of Object.keys(world.rooms)) {
    const Rm = world.rooms[k]; if (Rm.wx === undefined) continue;
    for (const [dir, t] of Object.entries(Rm.exits)) {
      const T = world.rooms[t]; if (!T || T.wx === undefined) continue;
      if (dir === "xp") {
        const len = Math.min(Rm.h, T.h, 2.24) * sc;
        ctx.fillRect(toX(Rm.wx + Rm.w) - 0.9, toY(Rm.wy + Rm.h / 2) - len / 2, 1.8, len);
      } else if (dir === "yp") {
        const len = Math.min(Rm.w, T.w, 2.24) * sc;
        ctx.fillRect(toX(Rm.wx + Rm.w / 2) - len / 2, toY(Rm.wy + Rm.h) - 0.9, len, 1.8);
      }
    }
  }
  ctx.restore();

  // Nombre de la sala encima del minimapa, alineado a su borde, en secundario.
  if (room.name) {
    ctx.fillStyle = ink2; ctx.font = "10px 'Courier New', monospace"; ctx.textBaseline = "top";
    if (minimapOnRight()) { ctx.textAlign = "right"; ctx.fillText(room.name, ox + MM + 4, oy - 16); }
    else { ctx.textAlign = "left"; ctx.fillText(room.name, ox - 4, oy - 16); }
    ctx.textAlign = "left";
  }
}

/* HUD — el marcador (circuitos + vidas + título) va dentro del triángulo negro mayor
   que deja el rombo del suelo abajo, repartido en varias filas. */
function drawHUD() {
  const C = CFG.COL, W = CFG.W;
  ctx.textBaseline = "top";

  const ink2 = room.ink2 || C.roomName;   // secundario de la sala para los textos del HUD

  // ── Marco inferior: barras segmentadas a los lados + aristas en "V" PARALELAS a los bordes
  //    frontales del rombo (pendiente ±0.5). Se dibuja PRIMERO, el marcador queda por encima.
  const ink = room.ink, fc = P(room.w, room.h, 0);   // pico frontal del rombo (proyectado)
  const GAP = Math.round(AP.DOOR.T * CFG.TILE_W);     // hueco bajo el pico (= ancho iso de puerta)
  const vx = Math.round(fc.x);
  const vy = Math.round(fc.y) + GAP;                  // vértice de la "V", GAP por debajo del pico
  const leftTopY = vy - 0.5 * (vx - 6), rightTopY = vy - 0.5 * ((W - 6) - vx);   // aristas a ±0.5
  drawSegBar(6, Math.round(leftTopY), 236, ink);
  drawSegBar(W - 6, Math.round(rightTopY), 236, ink);
  ctx.strokeStyle = ink; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, leftTopY);      ctx.lineTo(vx, vy);   // arista izquierda
  ctx.moveTo(W - 6, rightTopY); ctx.lineTo(vx, vy);   // arista derecha
  ctx.stroke();

  // ── MARCADOR en el triángulo mayor (el opuesto al minimapa). El triángulo se ensancha hacia
  //    abajo: la fila inferior (más ancha) lleva el título; las de arriba, los iconos.
  const onRight = !minimapOnRight();
  const PAD = 20, ax = onRight ? W - PAD : PAD;        // borde de anclaje (margen dentro del marco)
  const dy = 20, yTitle = 222, yCirc = yTitle - dy, yLife = yCirc - dy;

  drawTitle(ax, yTitle, onRight);                                  // título "ALIEN POCHO"
  drawStat(ax, yCirc, onRight, 18, (cx, cy) => drawCarrySlot(cx, cy, game.carried, ink, ink2),
           game.circuits + "/" + game.circuitsTotal, ink2);        // circuitos: casilla + N/M
  drawStat(ax, yLife, onRight, 14, (cx, cy) => drawMiniRobot(cx, cy, ink2),
           "×" + game.lives, ink2);                                // vidas: carita + ×N
}

/* Una FILA del marcador anclada a un borde: ICONO + NÚMERO (en este orden si va a la
   izquierda; invertido si va a la derecha, para que el icono quede pegado al borde). El icono
   lo pinta `drawIcon(cx, cy)` centrado; `iw` = su ancho, para reservarle el hueco. */
function drawStat(ax, y, onRight, iw, drawIcon, text, col) {
  const gap = 4, cy = y + 7;                          // centro vertical del icono ≈ centro del texto
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillStyle = col; ctx.textBaseline = "top";
  if (onRight) {                                      // [texto][icono] terminando en ax
    drawIcon(ax - iw / 2, cy);
    ctx.textAlign = "right"; ctx.fillText(text, ax - iw - gap, y);
  } else {                                            // [icono][texto] empezando en ax
    drawIcon(ax + iw / 2, cy);
    ctx.textAlign = "left"; ctx.fillText(text, ax + iw + gap, y);
  }
  ctx.textAlign = "left";
}

/* Título "ALIEN POCHO" con look neón: glow en el color de la sala + núcleo brillante.
   Anclado al borde (izq/dcha) según onRight. */
function drawTitle(ax, vy, onRight) {
  const ink = room.ink, y = vy + 2;
  ctx.save();
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.letterSpacing = "1.5px";
  ctx.textBaseline = "top"; ctx.textAlign = onRight ? "right" : "left";
  ctx.lineJoin = "round";
  const draw = () => { ctx.strokeText("ALIEN POCHO", ax, y); ctx.fillText("ALIEN POCHO", ax, y); };
  ctx.shadowColor = ink; ctx.shadowBlur = 6;          // resplandor (color de la sala)
  ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.fillStyle = ink;
  draw();
  ctx.shadowBlur = 0;                                  // núcleo nítido y brillante
  ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.fillStyle = ENGINE.lighten(ink, 0.6);
  draw();
  ctx.letterSpacing = "0px"; ctx.textAlign = "left";
  ctx.restore();
}
